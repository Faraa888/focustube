import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { storeEmailForExtension } from "@/lib/extensionStorage";

const Goals = () => {
  const navigate = useNavigate();
  const [goals, setGoals] = useState("");
  const [antiGoals, setAntiGoals] = useState("");
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
          goals: goals.trim(),
          anti_goals: antiGoals.trim(),
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
            goals: goals.trim(),
            anti_goals: antiGoals.trim(),
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
            <div className="space-y-2">
              <Label htmlFor="goals">
                What are you hoping to get out of YouTube and stay focused to?
              </Label>
              <Textarea
                id="goals"
                placeholder="e.g., Learn Python programming, Build a SaaS product, Study for exams..."
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                rows={4}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="anti-goals">
                What are your common pitfalls for distraction spirals on YouTube?
              </Label>
              <Textarea
                id="anti-goals"
                placeholder="e.g., Gaming videos, Celebrity gossip, Endless Shorts scrolling..."
                value={antiGoals}
                onChange={(e) => setAntiGoals(e.target.value)}
                rows={4}
                required
              />
            </div>

            {error && (
              <div className="text-sm text-red-500 text-center">{error}</div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving..." : "Continue to Download"}
            </Button>
          </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Goals;

