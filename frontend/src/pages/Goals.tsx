import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { storeEmailForExtension } from "@/lib/extensionStorage";
import { X } from "lucide-react";

const Goals = () => {
  const navigate = useNavigate();
  const [goals, setGoals] = useState<string[]>([]);
  const [antiGoals, setAntiGoals] = useState<string[]>([]);
  const [distractingChannels, setDistractingChannels] = useState<string[]>([]);
  const [goalInput, setGoalInput] = useState("");
  const [antiGoalInput, setAntiGoalInput] = useState("");
  const [channelInput, setChannelInput] = useState("");
  const [loading, setLoading] = useState(true); // Start with loading true
  const [error, setError] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check auth state on page load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Wait for session to initialize
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          setError("Failed to check authentication. Please try logging in again.");
          setCheckingAuth(false);
          setLoading(false);
          return;
        }

        if (!session || !session.user) {
          // No session, redirect to login
          setError("You must be logged in to set goals");
          setCheckingAuth(false);
          setLoading(false);
          // Redirect to login after a moment
          setTimeout(() => {
            navigate("/login");
          }, 2000);
          return;
        }

        // User is authenticated - store email for extension
        if (session.user?.email) {
          await storeEmailForExtension(session.user.email);
        }
        
        setCheckingAuth(false);
        setLoading(false);
      } catch (err) {
        console.error("Auth check error:", err);
        setError("Failed to check authentication. Please try logging in again.");
        setCheckingAuth(false);
        setLoading(false);
      }
    };

    checkAuth();
  }, [navigate]);

  // Helper: Add item to array with deduplication and max limit
  const addItem = (item: string, currentArray: string[], setArray: (arr: string[]) => void, maxItems: number = 5) => {
    const trimmed = item.trim();
    if (!trimmed) return;
    if (currentArray.length >= maxItems) {
      setError(`Maximum ${maxItems} items allowed. Remove one to add another.`);
      return;
    }
    if (currentArray.some(g => g.toLowerCase() === trimmed.toLowerCase())) {
      setError("This item is already added.");
      return;
    }
    setArray([...currentArray, trimmed]);
    setError("");
  };

  // Helper: Remove item from array
  const removeItem = (index: number, currentArray: string[], setArray: (arr: string[]) => void) => {
    setArray(currentArray.filter((_, i) => i !== index));
  };

  // Helper: Convert array to JSON string (filter empty, deduplicate)
  const arrayToJsonString = (arr: string[]): string => {
    const filtered = arr.filter(item => item.trim().length > 0);
    const unique = Array.from(new Set(filtered.map(item => item.trim())));
    return JSON.stringify(unique);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Get current user (should already be authenticated from useEffect)
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user || !user.email) {
        setError("You must be logged in to set goals. Redirecting to login...");
        setLoading(false);
        setTimeout(() => {
          navigate("/login");
        }, 2000);
        return;
      }

      // Check if user exists in users table, if not create them with trial plan
      const { data: existingUser } = await supabase
        .from("users")
        .select("email")
        .eq("email", user.email)
        .single();

      if (!existingUser) {
        // User doesn't exist in users table (OAuth signup), create them
        const trialStart = new Date();
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 14);

        const { data: userData, error: createError } = await supabase.from("users").upsert({
          email: user.email,
          plan: "trial",
          trial_started_at: trialStart.toISOString(),
          trial_expires_at: trialEnd.toISOString(),
          goals: arrayToJsonString(goals),
          anti_goals: arrayToJsonString(antiGoals),
          distracting_channels: arrayToJsonString(distractingChannels),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'email'
        });

        if (createError) {
          console.error("Error creating user:", createError);
          console.error("Error details:", {
            message: createError.message,
            code: createError.code,
            details: createError.details,
            hint: createError.hint
          });
          setError(`Failed to create account: ${createError.message}. Please try again or contact support.`);
          setLoading(false);
          return;
        } else {
          console.log("User created/updated successfully:", userData);
        }
      } else {
        // User exists, just update goals
        const { error: updateError } = await supabase
          .from("users")
          .update({
            goals: arrayToJsonString(goals),
            anti_goals: arrayToJsonString(antiGoals),
            distracting_channels: arrayToJsonString(distractingChannels),
            updated_at: new Date().toISOString(),
          })
          .eq("email", user.email);

        if (updateError) {
          console.error("Error updating goals:", updateError);
          setError("Failed to save goals. Please try again.");
          setLoading(false);
          return;
        }
      }

      // Redirect to download page
      navigate("/download");
    } catch (err) {
      console.error("Error:", err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Set Your Focus Goals</CardTitle>
          <CardDescription className="text-center">
            Help FocusTube understand what you want to achieve
          </CardDescription>
        </CardHeader>
        <CardContent>
          {checkingAuth ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground">Checking authentication...</div>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Focus Goals */}
            <div className="space-y-2">
              <Label htmlFor="goals">
                What are you hoping to get out of YouTube and stay focused to?
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Enter one item, click Add. Each goal saved separately. (Max 5)
              </p>
              <div className="flex gap-2">
                <Input
                  id="goals"
                  placeholder="e.g., Learn Python programming"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addItem(goalInput, goals, setGoals);
                      setGoalInput("");
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={() => {
                    addItem(goalInput, goals, setGoals);
                    setGoalInput("");
                  }}
                  variant="outline"
                >
                  Add Goal
                </Button>
              </div>
              {goals.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {goals.map((goal, index) => (
                    <Badge key={index} variant="default" className="flex items-center gap-1">
                      {goal}
                      <button
                        type="button"
                        onClick={() => removeItem(index, goals, setGoals)}
                        className="ml-1 hover:bg-primary/80 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              {goals.length === 0 && (
                <p className="text-xs text-muted-foreground">No goals added yet. Add at least one to continue.</p>
              )}
            </div>

            {/* Distraction Themes (Anti-goals) */}
            <div className="space-y-2">
              <Label htmlFor="anti-goals">
                What are your common pitfalls for distraction spirals on YouTube?
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Enter one item, click Add. Each distraction saved separately. (Max 5)
              </p>
              <div className="flex gap-2">
                <Input
                  id="anti-goals"
                  placeholder="e.g., Gaming videos"
                  value={antiGoalInput}
                  onChange={(e) => setAntiGoalInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addItem(antiGoalInput, antiGoals, setAntiGoals);
                      setAntiGoalInput("");
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={() => {
                    addItem(antiGoalInput, antiGoals, setAntiGoals);
                    setAntiGoalInput("");
                  }}
                  variant="outline"
                >
                  Add
                </Button>
              </div>
              {antiGoals.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {antiGoals.map((antiGoal, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {antiGoal}
                      <button
                        type="button"
                        onClick={() => removeItem(index, antiGoals, setAntiGoals)}
                        className="ml-1 hover:bg-secondary/80 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Distraction Channels */}
            <div className="space-y-2">
              <Label htmlFor="channels">
                Channels that usually derail you (optional)
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Enter channel names you waste time on. We'll monitor these closely. (Max 5)
              </p>
              <div className="flex gap-2">
                <Input
                  id="channels"
                  placeholder="e.g., Ali Abdaal"
                  value={channelInput}
                  onChange={(e) => setChannelInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addItem(channelInput, distractingChannels, setDistractingChannels);
                      setChannelInput("");
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={() => {
                    addItem(channelInput, distractingChannels, setDistractingChannels);
                    setChannelInput("");
                  }}
                  variant="outline"
                >
                  Add Channel
                </Button>
              </div>
              {distractingChannels.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {distractingChannels.map((channel, index) => (
                    <Badge key={index} variant="outline" className="flex items-center gap-1">
                      {channel}
                      <button
                        type="button"
                        onClick={() => removeItem(index, distractingChannels, setDistractingChannels)}
                        className="ml-1 hover:bg-secondary rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="text-sm text-red-500 text-center">{error}</div>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || goals.length === 0}
            >
              {loading ? "Saving..." : "Continue to Download"}
            </Button>
            {goals.length === 0 && (
              <p className="text-xs text-center text-muted-foreground">
                Please add at least one focus goal to continue.
              </p>
            )}
          </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Goals;

