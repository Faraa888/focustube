import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp, Flame, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import FocusScore from "@/components/dashboard/FocusScore";
import WatchTimeMap from "@/components/dashboard/WatchTimeMap";
import SpiralFeed from "@/components/dashboard/SpiralFeed";
import ChannelAudit from "@/components/dashboard/ChannelAudit";
import WeeklySummary from "@/components/dashboard/WeeklySummary";
import { useRequireAuth } from "@/hooks/useRequireAuth";

const Dashboard = () => {
  const authStatus = useRequireAuth();
  const isAuthenticated = authStatus === "authenticated";
  const loadingAuth = authStatus === "loading";
  
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [blockedChannels, setBlockedChannels] = useState<string[]>([]);
  const [blockingChannel, setBlockingChannel] = useState<string | null>(null);
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false);

  // Fetch dashboard stats and blocked channels
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) {
          setStatsLoading(false);
          return;
        }

        // Check plan via /license/verify to get can_record flag
        const planResponse = await fetch(
          `https://focustube-backend-4xah.onrender.com/license/verify?email=${encodeURIComponent(user.email)}`
        );
        if (planResponse.ok) {
          const planData = await planResponse.json();
          const canRecord = planData.can_record !== undefined ? planData.can_record : true;
          setShowUpgradeBanner(!canRecord);
        }

        // Fetch stats
        const statsResponse = await fetch(
          `https://focustube-backend-4xah.onrender.com/dashboard/stats?email=${encodeURIComponent(user.email)}`
        );

        if (!statsResponse.ok) {
          throw new Error(`Failed to fetch stats: ${statsResponse.status}`);
        }

        const statsData = await statsResponse.json();
        if (statsData.ok) {
          setStats(statsData);
        } else {
          throw new Error(statsData.error || "Failed to load stats");
        }

        // Fetch blocked channels
        const blockedResponse = await fetch(
          `https://focustube-backend-4xah.onrender.com/extension/get-data?email=${encodeURIComponent(user.email)}`
        );

        if (blockedResponse.ok) {
          const blockedData = await blockedResponse.json();
          const blocked = blockedData.ok && blockedData.data?.blocked_channels ? blockedData.data.blocked_channels : [];
          setBlockedChannels(blocked.map((ch: string) => ch.toLowerCase().trim()));
        }
      } catch (error: any) {
        console.error("Error fetching dashboard data:", error);
        setStatsError(error.message || "Failed to load dashboard data");
      } finally {
        setStatsLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const isExtensionConnected = stats !== null;

  // Show loading state while checking auth
  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }
  
  // If not authenticated, redirect will happen (this shouldn't render)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8 mt-16">
        {/* Upgrade Banner */}
        {showUpgradeBanner && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center justify-between gap-4">
            <span className="text-yellow-500 font-medium">
              Tracking paused — Upgrade to Pro to resume logging your sessions
            </span>
            <Button
              onClick={() => window.open("/pricing", "_blank")}
              size="sm"
              className="bg-yellow-500 hover:bg-yellow-600 text-black"
            >
              Upgrade
            </Button>
          </div>
        )}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Your Stats</h1>
          <p className="text-muted-foreground">
            Track your YouTube habits and stay focused
          </p>
        </div>

        {statsError && (
          <Card className="mb-8 border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Error loading dashboard</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {statsError}
                  </p>
                  <Button onClick={() => window.location.reload()}>
                    Retry
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!isExtensionConnected && !statsLoading && !statsError && (
          <Card className="mb-8 border-primary/50 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Extension not connected</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Install and connect the FocusTube extension to see your data
                  </p>
                  <Button asChild data-evt="dashboard_install">
                    <Link to="/download">Install Extension</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {statsLoading && (
          <div className="text-center py-12">
            <div className="text-muted-foreground">Loading dashboard data...</div>
          </div>
        )}

        {!statsLoading && stats && (
          <>
            {/* Focus Score - Large, centered at top */}
            <div className="mb-8 flex justify-center">
              <div className="w-full max-w-md">
                <FocusScore score={stats.focusScore7Day || 0} />
              </div>
            </div>

            {(stats.windowDays || stats.dataSource) && (
              <div className="mb-6 text-center text-xs text-muted-foreground">
                Data covers the last {stats.windowDays || 60} days
                {stats.dataSource === "extension" ? " (syncing from extension storage)" : ""}.
              </div>
            )}

            {/* Watch-Time Map - Full width */}
            <div className="mb-8">
              <WatchTimeMap
                hourlyData={stats.hourlyWatchTime || Array(24).fill(0)}
                breakdownWeek={stats.watchTime?.breakdownWeek || { productive: 0, neutral: 0, distracting: 0 }}
              />
            </div>

            {/* Two-column layout: Spiral Feed + Channel Audit */}
            <div className="grid gap-6 md:grid-cols-2 mb-8">
              <SpiralFeed events={stats.spiralEvents || []} />
              <ChannelAudit channels={stats.topChannels || []} />
            </div>

            {/* Weekly Summary - Full width at bottom */}
            <div className="mb-8">
              <WeeklySummary
                thisWeekMinutes={stats.watchTime?.thisWeekMinutes || 0}
                breakdownWeek={stats.watchTime?.breakdownWeek || { productive: 0, neutral: 0, distracting: 0 }}
                hourlyWatchTime={stats.hourlyWatchTime || Array(24).fill(0)}
              />
            </div>

            {/* Category Breakdown */}
            {stats.categoryBreakdown && stats.categoryBreakdown.length > 0 && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Content Categories</CardTitle>
                  <CardDescription>
                    What types of content you've been watching (last 30 days, ranked by watch time)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.categoryBreakdown.map((cat: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Badge variant="outline" className="rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                            {index + 1}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{cat.category}</div>
                            <div className="text-xs text-muted-foreground">
                              {cat.videos} {cat.videos === 1 ? "video" : "videos"} · {cat.minutes} min
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Top Distractions (if any) */}
            {stats.topDistractionsThisWeek && stats.topDistractionsThisWeek.length > 0 && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Biggest Distractions This Week</CardTitle>
                  <CardDescription>
                    Top distracting channels by watch time (last 7 days)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.topDistractionsThisWeek.map((distraction: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                        <div className="flex items-center gap-3">
                          <Badge variant="destructive" className="rounded-full w-8 h-8 flex items-center justify-center">
                            {index + 1}
                          </Badge>
                          <div>
                            <div className="font-medium">{distraction.channel}</div>
                            <div className="text-xs text-muted-foreground">
                              {distraction.videos} {distraction.videos === 1 ? "video" : "videos"} · {distraction.minutes} min
                            </div>
                          </div>
                        </div>
                        {blockedChannels.includes(distraction.channel.toLowerCase().trim()) ? (
                          <Badge variant="secondary" className="px-3 py-1">
                            Blocked
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              setBlockingChannel(distraction.channel);
                              try {
                                const { data: { user } } = await supabase.auth.getUser();
                                if (!user?.email) return;
                                
                                const response = await fetch(
                                  `https://focustube-backend-4xah.onrender.com/extension/get-data?email=${encodeURIComponent(user.email)}`
                                );
                                const result = await response.json();
                                const currentBlocked = result.ok && result.data?.blocked_channels ? result.data.blocked_channels : [];
                                const updatedBlocked = [...currentBlocked, distraction.channel];
                                
                                const saveResponse = await fetch("https://focustube-backend-4xah.onrender.com/extension/save-data", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    email: user.email,
                                    data: { blocked_channels: updatedBlocked },
                                  }),
                                });
                                
                                if (saveResponse.ok) {
                                  setBlockedChannels([...blockedChannels, distraction.channel.toLowerCase().trim()]);
                                  
                                  toast({
                                    title: "Channel blocked",
                                    description: "Well done! Eliminating distractions helps you stay focused.",
                                  });
                                  
                                  // Notify extension to reload settings immediately
                                  // Add small delay to ensure server has finished saving
                                  setTimeout(() => {
                                    try {
                                      window.postMessage({
                                        type: "FT_RELOAD_SETTINGS",
                                        requestId: `dashboard_block_${Date.now()}`
                                      }, window.location.origin);
                                      console.log("[Dashboard] Sent FT_RELOAD_SETTINGS message to extension (block channel)");
                                    } catch (err) {
                                      console.log("Extension not available for immediate sync");
                                    }
                                  }, 500); // Wait 500ms for server to finish saving
                                } else {
                                  throw new Error("Failed to save");
                                }
                              } catch (error: any) {
                                console.error("Error blocking channel:", error);
                                toast({
                                  title: "Error",
                                  description: "Failed to block channel. Please try again.",
                                  variant: "destructive",
                                });
                              } finally {
                                setBlockingChannel(null);
                              }
                            }}
                            disabled={blockingChannel === distraction.channel}
                          >
                            {blockingChannel === distraction.channel ? "Blocking..." : "Block"}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Cleanup Suggestion - Removed "Block All Distractions" button per user request */}
          </>
        )}

      </main>

      <Footer />
    </div>
  );
};

export default Dashboard;
