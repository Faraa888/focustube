import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp, Flame, AlertCircle } from "lucide-react";

const Dashboard = () => {
  // TODO: Replace with real data from extension
  const isExtensionConnected = false;
  
  const mockData = {
    watchTime: "2h 34m",
    focusScore: 78,
    streak: 5,
    topDistractingChannels: [
      { name: "Random Entertainment", views: 24 },
      { name: "Gaming Clips", views: 18 },
      { name: "Viral Videos", views: 12 },
    ],
    weeklyTrend: [65, 72, 68, 75, 78, 82, 78],
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8 mt-16">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Track your YouTube habits and stay focused
          </p>
        </div>

        {!isExtensionConnected && (
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

        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Watch Time Today
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{mockData.watchTime}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {isExtensionConnected ? "45m below your goal" : "Connect extension to track"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Focus Score
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{mockData.focusScore}%</div>
              <p className="text-xs text-green-500 mt-1">
                {isExtensionConnected ? "+5% from last week" : "Connect extension to track"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Streak
              </CardTitle>
              <Flame className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{mockData.streak} days</div>
              <p className="text-xs text-muted-foreground mt-1">
                {isExtensionConnected ? "Keep it going!" : "Connect extension to track"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>7-Day Focus Trend</CardTitle>
              <CardDescription>
                Your focus score over the past week
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* TODO: Replace with actual chart library (recharts or similar) */}
              <div className="h-48 flex items-end justify-between gap-2">
                {mockData.weeklyTrend.map((score, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-primary/20 rounded-t hover:bg-primary/40 transition-colors relative group"
                    style={{ height: `${score}%` }}
                  >
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      {score}%
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
                <span>Sun</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Distracting Channels</CardTitle>
              <CardDescription>
                Channels pulling you off-track this week
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockData.topDistractingChannels.map((channel, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="rounded-full w-8 h-8 flex items-center justify-center">
                        {i + 1}
                      </Badge>
                      <span className="font-medium">{channel.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {channel.views} views
                    </span>
                  </div>
                ))}
              </div>
              {!isExtensionConnected && (
                <p className="text-sm text-muted-foreground text-center mt-6">
                  Connect extension to see real data
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 flex justify-center gap-4">
          <Button variant="outline" asChild>
            <Link to="/app/settings">Adjust Settings</Link>
          </Button>
          <Button variant="ghost" disabled>
            View Journal (Coming Soon)
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Dashboard;
