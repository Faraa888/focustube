import { useState } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";

const Settings = () => {
  const [blockShorts, setBlockShorts] = useState(true);
  const [hideRecommendations, setHideRecommendations] = useState(false);
  const [dailyLimit, setDailyLimit] = useState([90]);
  const [goals, setGoals] = useState("Learn web development\nImprove public speaking");
  const [antiGoals, setAntiGoals] = useState("Gaming content\nViral entertainment");

  const handleSave = () => {
    // TODO: Save settings to backend/extension
    toast({
      title: "Settings saved",
      description: "Your preferences have been updated.",
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8 mt-16 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Customize FocusTube to match your goals
          </p>
        </div>

        <Tabs defaultValue="goals" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="goals">Goals</TabsTrigger>
            <TabsTrigger value="controls">Controls</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
          </TabsList>

          <TabsContent value="goals" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Goals</CardTitle>
                <CardDescription>
                  What do you want to learn or accomplish? FocusTube will help you stay on track.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="goals">Learning goals (one per line)</Label>
                  <Textarea
                    id="goals"
                    placeholder="e.g., Learn React&#10;Practice guitar&#10;Study for certification"
                    value={goals}
                    onChange={(e) => setGoals(e.target.value)}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    FocusTube will prioritize content related to these goals
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distractions to Avoid</CardTitle>
                <CardDescription>
                  Topics that tend to pull you off-track
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="antigoals">Avoid these topics (one per line)</Label>
                  <Textarea
                    id="antigoals"
                    placeholder="e.g., Gaming streams&#10;Celebrity news&#10;Viral challenges"
                    value={antiGoals}
                    onChange={(e) => setAntiGoals(e.target.value)}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    FocusTube will filter out content matching these topics
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="controls" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Content Filters</CardTitle>
                <CardDescription>
                  Block distracting features on YouTube
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Block YouTube Shorts</Label>
                    <p className="text-sm text-muted-foreground">
                      Hide the Shorts feed and suggestions
                    </p>
                  </div>
                  <Switch
                    checked={blockShorts}
                    onCheckedChange={setBlockShorts}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Hide Recommendations</Label>
                    <p className="text-sm text-muted-foreground">
                      Remove suggested videos from sidebar
                    </p>
                  </div>
                  <Switch
                    checked={hideRecommendations}
                    onCheckedChange={setHideRecommendations}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Time Limits</CardTitle>
                <CardDescription>
                  Set daily usage goals and boundaries
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Daily limit</Label>
                    <Badge variant="secondary">{dailyLimit[0]} minutes</Badge>
                  </div>
                  <Slider
                    value={dailyLimit}
                    onValueChange={setDailyLimit}
                    min={15}
                    max={150}
                    step={15}
                  />
                  <p className="text-xs text-muted-foreground">
                    You'll receive gentle nudges when approaching this limit
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="allowed-hours">Allowed hours (optional)</Label>
                  <Input
                    id="allowed-hours"
                    placeholder="e.g., 6pm-10pm"
                    type="text"
                  />
                  <p className="text-xs text-muted-foreground">
                    Limit YouTube access to specific times
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Nudge Style</CardTitle>
                <CardDescription>
                  How should FocusTube remind you?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  <Button variant="outline" className="justify-start">
                    <span className="flex-1 text-left">Gentle — "Still learning?"</span>
                  </Button>
                  <Button variant="outline" className="justify-start">
                    <span className="flex-1 text-left">Direct — "Check your goals"</span>
                  </Button>
                  <Button variant="outline" className="justify-start">
                    <span className="flex-1 text-left">Firm — "Time's up"</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Subscription</CardTitle>
                <CardDescription>
                  Manage your FocusTube plan
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-semibold">Free Plan</div>
                    <div className="text-sm text-muted-foreground">
                      Basic features included
                    </div>
                  </div>
                  <Button asChild data-evt="settings_upgrade">
                    <Link to="/pricing">Upgrade to Pro</Link>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Pro includes AI filtering, advanced analytics, and priority support
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Data & Privacy</CardTitle>
                <CardDescription>
                  Your data stays on your device
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  FocusTube processes your YouTube activity locally. We never sell your data.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    Export Data
                  </Button>
                  <Button variant="outline" size="sm">
                    Clear History
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="destructive" className="w-full">
                  Delete Account
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  This action cannot be undone
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-8 flex justify-end gap-4">
          <Button variant="outline" asChild>
            <Link to="/app/dashboard">Cancel</Link>
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Settings;
