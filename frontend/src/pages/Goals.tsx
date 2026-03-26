import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { storeEmailForExtension } from "@/lib/extensionStorage";

const Goals = () => {
  const navigate = useNavigate();
  const [goalsText, setGoalsText] = useState("");
  const [pitfallsText, setPitfallsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          setError("Failed to check authentication. Please try logging in again.");
          setCheckingAuth(false);
          return;
        }

        if (!session || !session.user) {
          setError("You must be logged in to set goals");
          setCheckingAuth(false);
          setTimeout(() => navigate("/login"), 2000);
          return;
        }

        if (session.user?.email) {
          await storeEmailForExtension(session.user.email);
        }

        setCheckingAuth(false);
      } catch (err) {
        setError("Failed to check authentication. Please try logging in again.");
        setCheckingAuth(false);
      }
    };

    checkAuth();
  }, [navigate]);

  const handleSkip = () => {
    window.location.href = "https://www.youtube.com";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user || !user.email) {
        setError("You must be logged in to set goals. Redirecting to login...");
        setLoading(false);
        setTimeout(() => navigate("/login"), 2000);
        return;
      }

      // Store goals and pitfalls as single-element JSON arrays so the
      // classifier receives the full sentence rather than keyword fragments
      const goalsValue = goalsText.trim()
        ? JSON.stringify([goalsText.trim()])
        : JSON.stringify([]);
      const pitfallsValue = pitfallsText.trim()
        ? JSON.stringify([pitfallsText.trim()])
        : JSON.stringify([]);

      const { data: existingUser } = await supabase
        .from("users")
        .select("email")
        .eq("email", user.email)
        .single();

      if (!existingUser) {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 14);

        const { error: createError } = await supabase.from("users").upsert(
          {
            email: user.email,
            plan: "trial",
            trial_expires_at: trialEnd.toISOString(),
            goals: goalsValue,
            pitfalls: pitfallsValue,
            blocked_channels: JSON.stringify([]),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "email" }
        );

        if (createError) {
          setError(`Failed to create account: ${createError.message}. Please try again or contact support.`);
          setLoading(false);
          return;
        }
      } else {
        const { error: updateError } = await supabase
          .from("users")
          .update({
            goals: goalsValue,
            pitfalls: pitfallsValue,
            updated_at: new Date().toISOString(),
          })
          .eq("email", user.email);

        if (updateError) {
          setError("Failed to save goals. Please try again.");
          setLoading(false);
          return;
        }
      }

      window.location.href = "https://www.youtube.com";
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Set up your focus profile</CardTitle>
          <CardDescription className="text-center">
            Tell FocusTube what you're here to learn — and what tends to pull you off track.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {checkingAuth ? (
            <div className="text-center py-8 text-muted-foreground">
              Checking authentication...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="goals">What are you trying to achieve with YouTube?</Label>
                <Textarea
                  id="goals"
                  placeholder="e.g. Improve my Portuguese for a trip to Brazil in June. I want to be conversational, not fluent."
                  value={goalsText}
                  onChange={(e) => setGoalsText(e.target.value)}
                  maxLength={500}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {goalsText.length}/500
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pitfalls">What usually derails you?</Label>
                <Textarea
                  id="pitfalls"
                  placeholder="e.g. Gaming videos, reaction content, celebrity drama — I tell myself I'll watch one and then lose an hour."
                  value={pitfallsText}
                  onChange={(e) => setPitfallsText(e.target.value)}
                  maxLength={500}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {pitfallsText.length}/500
                </p>
              </div>

              {error && (
                <div className="text-sm text-red-500 text-center">{error}</div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading || !goalsText.trim()}
              >
                {loading ? "Saving..." : "Save and start using FocusTube"}
              </Button>

              <button
                type="button"
                onClick={handleSkip}
                className="w-full text-sm text-muted-foreground hover:text-foreground text-center block"
              >
                Skip for now
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Goals;
