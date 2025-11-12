import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp, Flame, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
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

  // Fetch dashboard stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) {
          setStatsLoading(false);
          return;
        }

        const response = await fetch(
          `https://focustube-backend-4xah.onrender.com/dashboard/stats?email=${encodeURIComponent(user.email)}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch stats: ${response.status}`);
        }

        const data = await response.json();
        if (data.ok) {
          setStats(data);
        } else {
          throw new Error(data.error || "Failed to load stats");
        }
      } catch (error: any) {
        console.error("Error fetching dashboard stats:", error);
        setStatsError(error.message || "Failed to load dashboard data");
      } finally {
        setStatsLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchStats();
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

            {/* Top Distractions (if any) */}
            {stats.topDistractionsThisWeek && stats.topDistractionsThisWeek.length > 0 && (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle>Biggest Distractions This Week</CardTitle>
                  <CardDescription>
                    Top channels pulling you off-track
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            // Block channel logic (similar to ChannelAudit)
                            const { data: { user } } = await supabase.auth.getUser();
                            if (!user?.email) return;
                            
                            const response = await fetch(
                              `https://focustube-backend-4xah.onrender.com/extension/get-data?email=${encodeURIComponent(user.email)}`
                            );
                            const result = await response.json();
                            const currentBlocked = result.ok && result.data?.blocked_channels ? result.data.blocked_channels : [];
                            const updatedBlocked = [...currentBlocked, distraction.channel];
                            
                            await fetch("https://focustube-backend-4xah.onrender.com/extension/save-data", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                email: user.email,
                                data: { blocked_channels: updatedBlocked },
                              }),
                            });
                            
                            window.location.reload();
                          }}
                        >
                          Block
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Cleanup Suggestion */}
            {stats.cleanupSuggestion?.hasDistractions && (
              <Card className="mb-8 border-primary/50 bg-primary/5">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <AlertCircle className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">Consider Cleaning Up?</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        You watched {stats.cleanupSuggestion.minutes} minutes of content from channels you've marked as distracting this week.
                      </p>
                      <Button asChild variant="outline">
                        <Link to="/app/settings">Block All Distractions</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

      </main>

      <Footer />
    </div>
  );
};

export default Dashboard;
