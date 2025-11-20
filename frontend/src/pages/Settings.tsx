import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { removeEmailFromExtension } from "@/lib/extensionStorage";
import { X, Plus } from "lucide-react";
import { useRequireAuth } from "@/hooks/useRequireAuth";

const Settings = () => {
  const navigate = useNavigate();
  const authStatus = useRequireAuth();
  const isAuthenticated = authStatus === "authenticated";
  const loadingAuth = authStatus === "loading";
  
  // Goals state
  const [goals, setGoals] = useState<string[]>([]);
  const [antiGoals, setAntiGoals] = useState<string[]>([]);
  const [goalInput, setGoalInput] = useState("");
  const [antiGoalInput, setAntiGoalInput] = useState("");
  const [savingGoals, setSavingGoals] = useState(false);
  
  // Blocked channels state
  const [blockedChannels, setBlockedChannels] = useState<string[]>([]);
  const [newChannelName, setNewChannelName] = useState("");
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [savingChannel, setSavingChannel] = useState(false);
  
  // Controls state
  const [blockShorts, setBlockShorts] = useState(false);
  const [hideRecommendations, setHideRecommendations] = useState(false);
  const [dailyLimit, setDailyLimit] = useState([90]);
  const [focusWindowEnabled, setFocusWindowEnabled] = useState(false);
  const [focusWindowStart, setFocusWindowStart] = useState("1:00 PM");
  const [focusWindowEnd, setFocusWindowEnd] = useState("6:00 PM");
  const [nudgeStyle, setNudgeStyle] = useState<"gentle" | "direct" | "firm">("firm");
  const [savingSettings, setSavingSettings] = useState(false);
  
  const [userPlan, setUserPlan] = useState<"free" | "pro" | "trial">("free");
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Load all settings on mount
  useEffect(() => {
    if (authStatus === "loading") return;
    if (authStatus !== "authenticated") {
      setLoadingChannels(false);
      setLoadingSettings(false);
      return;
    }

    const loadSettings = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) {
          setLoadingChannels(false);
          setLoadingSettings(false);
          return;
        }

        // Get user plan and goals
        const { data: userData } = await supabase
          .from("users")
          .select("plan, goals, anti_goals")
          .eq("email", user.email)
          .single();
        
        if (userData) {
          setUserPlan(userData.plan || "free");
          
          // Parse goals and anti-goals from JSON (show exact saved, no defaults)
          if (userData.goals) {
            try {
              const parsed = JSON.parse(userData.goals);
              setGoals(Array.isArray(parsed) ? parsed : []);
            } catch {
              setGoals([]);
            }
          } else {
            setGoals([]);
          }
          
          if (userData.anti_goals) {
            try {
              const parsed = JSON.parse(userData.anti_goals);
              setAntiGoals(Array.isArray(parsed) ? parsed : []);
            } catch {
              setAntiGoals([]);
            }
          } else {
            setAntiGoals([]);
          }
        }

        // Get extension data (blocked channels, settings)
        const response = await fetch(
          `https://focustube-backend-4xah.onrender.com/extension/get-data?email=${encodeURIComponent(user.email)}`
        );

        if (response.ok) {
          const result = await response.json();
          if (result.ok && result.data) {
            // Load blocked channels (exact saved, no defaults)
            if (result.data.blocked_channels) {
              setBlockedChannels(Array.isArray(result.data.blocked_channels) ? result.data.blocked_channels : []);
            } else {
              setBlockedChannels([]);
            }
            
            // Load all settings (exact saved, no defaults)
            const settings = result.data.settings || {};
            if (settings.focus_window_enabled !== undefined) {
              setFocusWindowEnabled(settings.focus_window_enabled);
            }
            if (settings.focus_window_start) {
              setFocusWindowStart(convert24hTo12h(settings.focus_window_start));
            }
            if (settings.focus_window_end) {
              setFocusWindowEnd(convert24hTo12h(settings.focus_window_end));
            }
            if (settings.block_shorts !== undefined) {
              setBlockShorts(settings.block_shorts);
            }
            if (settings.hide_recommendations !== undefined) {
              setHideRecommendations(settings.hide_recommendations);
            }
            if (settings.daily_limit) {
              setDailyLimit([settings.daily_limit]);
            } else {
              setDailyLimit([90]); // Default only if not set
            }
            if (settings.nudge_style) {
              setNudgeStyle(settings.nudge_style);
            } else {
              setNudgeStyle("firm"); // Default only if not set
            }
          }
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      } finally {
        setLoadingChannels(false);
        setLoadingSettings(false);
      }
    };

    loadSettings();
  }, [authStatus]);

  // Helper: Convert 24h format (13:00) to 12h format (1:00 PM)
  const convert24hTo12h = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Helper: Convert 12h format (1:00 PM) to 24h format (13:00)
  const convert12hTo24h = (time12: string): string => {
    const [time, period] = time12.split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    let hours24 = hours;
    if (period === 'PM' && hours !== 12) {
      hours24 = hours + 12;
    } else if (period === 'AM' && hours === 12) {
      hours24 = 0;
    }
    return `${hours24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  // Goals helpers
  const addGoal = () => {
    const trimmed = goalInput.trim();
    if (!trimmed) return;
    if (goals.length >= 5) {
      toast({
        title: "Maximum reached",
        description: "You can add up to 5 goals. Remove one to add another.",
        variant: "destructive",
      });
      return;
    }
    if (goals.some(g => g.toLowerCase() === trimmed.toLowerCase())) {
      toast({
        title: "Already added",
        description: "This goal is already in your list.",
      });
      return;
    }
    setGoals([...goals, trimmed]);
    setGoalInput("");
  };

  const removeGoal = (index: number) => {
    setGoals(goals.filter((_, i) => i !== index));
  };

  const addAntiGoal = () => {
    const trimmed = antiGoalInput.trim();
    if (!trimmed) return;
    if (antiGoals.length >= 5) {
      toast({
        title: "Maximum reached",
        description: "You can add up to 5 distractions. Remove one to add another.",
        variant: "destructive",
      });
      return;
    }
    if (antiGoals.some(g => g.toLowerCase() === trimmed.toLowerCase())) {
      toast({
        title: "Already added",
        description: "This distraction is already in your list.",
      });
      return;
    }
    setAntiGoals([...antiGoals, trimmed]);
    setAntiGoalInput("");
  };

  const removeAntiGoal = (index: number) => {
    setAntiGoals(antiGoals.filter((_, i) => i !== index));
  };

  // Save goals
  const handleSaveGoals = async () => {
    setSavingGoals(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        toast({
          title: "Error",
          description: "You must be logged in to save goals",
          variant: "destructive",
        });
        setSavingGoals(false);
        return;
      }

      const { error } = await supabase
        .from("users")
        .update({
          goals: JSON.stringify(goals),
          anti_goals: JSON.stringify(antiGoals),
          updated_at: new Date().toISOString(),
        })
        .eq("email", user.email);

      if (error) throw error;

      toast({
        title: "Goals saved",
        description: "Your goals have been updated.",
      });
      
      // Notify extension to reload settings immediately (goals affect AI classification)
      try {
        window.postMessage({
          type: "FT_RELOAD_SETTINGS",
          requestId: `goals_${Date.now()}`
        }, window.location.origin);
      } catch (err) {
        console.log("Extension not available for immediate sync (will sync on next reload)");
      }
    } catch (error) {
      console.error("Error saving goals:", error);
      toast({
        title: "Error",
        description: "Failed to save goals. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingGoals(false);
    }
  };

  // Save blocked channels with normalization
  const handleSaveBlockedChannels = async () => {
    if (blockedChannels.length === 0) {
      toast({
        title: "No channels",
        description: "Add at least one channel to block.",
        variant: "destructive",
      });
      return;
    }

    setSavingChannel(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        toast({
          title: "Error",
          description: "You must be logged in to block channels",
          variant: "destructive",
        });
        setSavingChannel(false);
        return;
      }

      // Normalize all channel names
      console.log("[Settings] 🔄 Starting normalization for channels:", blockedChannels);
      
      const normalizeResponse = await fetch("https://focustube-backend-4xah.onrender.com/ai/normalize-channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel_names: blockedChannels }),
      });

      let normalizedChannels = blockedChannels;
      let normalizationWarning = null;
      
      if (normalizeResponse.ok) {
        const normalizeData = await normalizeResponse.json();
        console.log("[Settings] 📥 Normalization response:", normalizeData);
        
        if (normalizeData.ok && normalizeData.normalized_names) {
          normalizedChannels = normalizeData.normalized_names;
          console.log("[Settings] ✅ Normalized channels:", normalizedChannels);
          
          // Check if any names actually changed
          const namesChanged = normalizedChannels.some((name: string, idx: number) => 
            name.toLowerCase().trim() !== blockedChannels[idx]?.toLowerCase().trim()
          );
          
          if (!namesChanged) {
            console.warn("[Settings] ⚠️ No channel names changed after normalization");
          }
          
          // Check for warnings
          if (normalizeData.warning) {
            normalizationWarning = normalizeData.warning;
            console.warn("[Settings] ⚠️ Normalization warning:", normalizeData.warning);
          }
        } else {
          console.warn("[Settings] ⚠️ Normalization response missing normalized_names, using original");
        }
      } else {
        const errorText = await normalizeResponse.text().catch(() => "Unknown error");
        console.error("[Settings] ❌ Normalization API failed:", normalizeResponse.status, errorText);
        normalizationWarning = `Normalization API returned ${normalizeResponse.status}`;
      }
      
      // Show warning toast if normalization had issues (but still save)
      if (normalizationWarning) {
        toast({
          title: "Normalisation Warning",
          description: `Some channel names may not have been normalised: ${normalizationWarning}`,
          variant: "default",
        });
      }

      // Save normalized channels
      const response = await fetch("https://focustube-backend-4xah.onrender.com/extension/save-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          data: {
            blocked_channels: normalizedChannels,
          },
        }),
      });

      if (response.ok) {
        // Show success toast with normalization info
        const changedCount = normalizedChannels.filter((name: string, idx: number) => 
          name.toLowerCase().trim() !== blockedChannels[idx]?.toLowerCase().trim()
        ).length;
        
        toast({
          title: "Channels Saved",
          description: changedCount > 0 
            ? `${changedCount} channel name(s) normalised and saved`
            : "Channels saved (no normalisation needed)",
          variant: "default",
        });
        
        // Notify extension to reload settings immediately (no page reload needed)
        try {
          window.postMessage({
            type: "FT_RELOAD_SETTINGS",
            requestId: `channels_${Date.now()}`
          }, window.location.origin);
        } catch (err) {
          console.log("Extension not available for immediate sync (will sync on next reload)");
        }
      } else {
        throw new Error("Failed to save");
      }
    } catch (error) {
      console.error("Error saving blocked channels:", error);
      toast({
        title: "Error",
        description: "Failed to save blocked channels. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingChannel(false);
    }
  };

  const handleAddChannel = () => {
    const trimmed = newChannelName.trim();
    if (!trimmed) {
      toast({
        title: "Error",
        description: "Please enter a channel name",
        variant: "destructive",
      });
      return;
    }

    const channelLower = trimmed.toLowerCase();
    const isAlreadyBlocked = blockedChannels.some(
      ch => ch.toLowerCase().trim() === channelLower
    );

    if (isAlreadyBlocked) {
      toast({
        title: "Already blocked",
        description: "This channel is already in your blocklist",
      });
      setNewChannelName("");
      return;
    }

    setBlockedChannels([...blockedChannels, trimmed]);
    setNewChannelName("");
  };


  // Save controls settings
  const handleSaveControls = async () => {
    setSavingSettings(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        toast({
          title: "Error",
          description: "You must be logged in to save settings",
          variant: "destructive",
        });
        setSavingSettings(false);
        return;
      }

      const settings = {
        focus_window_enabled: focusWindowEnabled,
        focus_window_start: convert12hTo24h(focusWindowStart),
        focus_window_end: convert12hTo24h(focusWindowEnd),
        block_shorts: blockShorts,
        hide_recommendations: hideRecommendations,
        daily_limit: dailyLimit[0],
        nudge_style: nudgeStyle,
      };

      const response = await fetch("https://focustube-backend-4xah.onrender.com/extension/save-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          data: {
            settings: settings,
          },
        }),
      });

      if (response.ok) {
    toast({
      title: "Settings saved",
      description: "Your preferences have been updated.",
    });
        
        // Notify extension to reload settings immediately (no reload needed)
        try {
          // Send message to extension via postMessage (handled by website-bridge.js)
          window.postMessage({
            type: "FT_RELOAD_SETTINGS",
            requestId: `settings_${Date.now()}`
          }, window.location.origin);
        } catch (err) {
          // Extension might not be installed, that's okay
          console.log("Extension not available for immediate sync (will sync on next reload)");
        }
      } else {
        throw new Error("Failed to save");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      await removeEmailFromExtension();
      navigate("/login");
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
    } catch (err) {
      console.error("Logout error:", err);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loadingAuth || loadingSettings) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const isProExperience = userPlan === "pro" || userPlan === "trial";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8 mt-16 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Your FocusTube</h1>
          <p className="text-muted-foreground">
            Customise FocusTube to match your goals
          </p>
        </div>

        <Tabs defaultValue="goals" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="goals">Goals</TabsTrigger>
            <TabsTrigger value="blocked">Blocked Channels</TabsTrigger>
            <TabsTrigger value="controls">Controls</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
          </TabsList>

          {/* Goals Tab */}
          <TabsContent value="goals" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Goals</CardTitle>
                <CardDescription>
                  What do you want to learn or accomplish whilst using YouTube? FocusTube will help you stay on track.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., Learn React"
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addGoal();
                      }
                    }}
                    disabled={goals.length >= 5}
                  />
                  <Button
                    onClick={addGoal}
                    disabled={goals.length >= 5 || !goalInput.trim()}
                    variant="outline"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
                
                {goals.length > 0 ? (
                  <div className="space-y-2">
                    {goals.map((goal, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <span className="font-medium">{goal}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeGoal(index)}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No goals added yet. Add your first goal above.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Common Distractions</CardTitle>
                <CardDescription>
                  What are the topics that tend to pull you off-track
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., Gaming streams"
                    value={antiGoalInput}
                    onChange={(e) => setAntiGoalInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addAntiGoal();
                      }
                    }}
                    disabled={antiGoals.length >= 5}
                  />
                  <Button
                    onClick={addAntiGoal}
                    disabled={antiGoals.length >= 5 || !antiGoalInput.trim()}
                    variant="outline"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
                
                {antiGoals.length > 0 ? (
                  <div className="space-y-2">
                    {antiGoals.map((antiGoal, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <span className="font-medium">{antiGoal}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAntiGoal(index)}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No distractions added yet. Add your first distraction above.
                  </p>
                )}
              </CardContent>
            </Card>
            
            <Button onClick={handleSaveGoals} disabled={savingGoals} className="w-full">
              {savingGoals ? "Saving..." : "Save Goals"}
            </Button>
          </TabsContent>

          {/* Blocked Channels Tab */}
          <TabsContent value="blocked" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Blocked Channels</CardTitle>
                <CardDescription>
                  Channels you have blocked to stay focused. All names will be normalised when you save.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 p-3 rounded-lg border">
                  <p className="text-sm text-muted-foreground">
                    Channels are permanently blocked once added. Use the monthly reset feature to clear all (coming soon).
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter channel name (e.g., Eddie Hall)"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddChannel();
                      }
                    }}
                    disabled={savingChannel}
                  />
                  <Button
                    onClick={handleAddChannel}
                    disabled={savingChannel || !newChannelName.trim()}
                    variant="outline"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
                
                {loadingChannels ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Loading blocked channels...</p>
                ) : blockedChannels.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No channels blocked yet</p>
                ) : (
                  <div className="space-y-2">
                    {blockedChannels.map((channel, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <span className="font-medium">{channel}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                <Button
                  onClick={handleSaveBlockedChannels}
                  disabled={savingChannel || blockedChannels.length === 0}
                  className="w-full"
                >
                  {savingChannel ? "Normalising & Saving..." : "Save & Normalise Channels"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Channel names will be normalised to match YouTube metadata. The page will refresh after saving.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Controls Tab */}
          <TabsContent value="controls" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Content Filters</CardTitle>
                <CardDescription>
                  Block distracting features on YouTube
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isProExperience && (
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                      <Label className="text-base">Hard Block Shorts / Track Shorts with Reminders</Label>
                    <p className="text-sm text-muted-foreground">
                        {blockShorts ? "Hard block Shorts (Free behavior)" : "Track Shorts with reminders (Pro behavior)"}
                    </p>
                  </div>
                  <Switch
                    checked={blockShorts}
                    onCheckedChange={setBlockShorts}
                  />
                </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Hide Recommendations</Label>
                    <p className="text-sm text-muted-foreground">
                      Remove suggested videos from sidebar and homepage
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Focus Window</CardTitle>
                <CardDescription>
                  Set specific hours when YouTube is accessible
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Enable Focus Window</Label>
                    <p className="text-sm text-muted-foreground">
                      Restrict YouTube access to specific hours
                    </p>
                  </div>
                  <Switch
                    checked={focusWindowEnabled}
                    onCheckedChange={setFocusWindowEnabled}
                  />
                </div>

                {focusWindowEnabled && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="focus-window-start">From</Label>
                        <Input
                          id="focus-window-start"
                          type="text"
                          value={focusWindowStart}
                          onChange={(e) => setFocusWindowStart(e.target.value)}
                          placeholder="1:00 PM"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="focus-window-end">Until</Label>
                        <Input
                          id="focus-window-end"
                          type="text"
                          value={focusWindowEnd}
                          onChange={(e) => setFocusWindowEnd(e.target.value)}
                          placeholder="6:00 PM"
                        />
                      </div>
                    </div>
                  </div>
                )}
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
                  <Button
                    variant={nudgeStyle === "gentle" ? "default" : "outline"}
                    className="justify-start"
                    onClick={() => setNudgeStyle("gentle")}
                  >
                    <span className="flex-1 text-left">Gentle — "Still learning?"</span>
                  </Button>
                  <Button
                    variant={nudgeStyle === "direct" ? "default" : "outline"}
                    className="justify-start"
                    onClick={() => setNudgeStyle("direct")}
                  >
                    <span className="flex-1 text-left">Direct — "Check your goals"</span>
                  </Button>
                  <Button
                    variant={nudgeStyle === "firm" ? "default" : "outline"}
                    className="justify-start"
                    onClick={() => setNudgeStyle("firm")}
                  >
                    <span className="flex-1 text-left">Firm — "Time's up, no more watching"</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Button onClick={handleSaveControls} disabled={savingSettings} className="w-full">
              {savingSettings ? "Saving..." : "Save All Controls"}
            </Button>
          </TabsContent>

          {/* Account Tab */}
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
                    <div className="font-semibold">{userPlan === "free" ? "Free Plan" : userPlan === "trial" ? "Trial Plan" : "Pro Plan"}</div>
                    <div className="text-sm text-muted-foreground">
                      {userPlan === "free" ? "Basic features included" : "Full features included"}
                    </div>
                  </div>
                  {userPlan === "free" && (
                  <Button asChild data-evt="settings_upgrade">
                    <Link to="/pricing">Upgrade to Pro</Link>
                  </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sign Out</CardTitle>
                <CardDescription>
                  Sign out of your FocusTube account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={handleLogout}
                >
                  Sign Out
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
};

export default Settings;
