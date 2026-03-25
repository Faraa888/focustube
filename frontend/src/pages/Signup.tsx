import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Chrome, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { storeEmailForExtension } from "@/lib/extensionStorage";
import { validateEmail } from "@/lib/emailValidation";

const Signup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailConfirmationSent, setEmailConfirmationSent] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  // Check for existing valid session on page load
  useEffect(() => {
    const checkExistingSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      // If there's a valid session and no error, redirect to dashboard
      if (session && !error) {
        console.log('[Signup] Valid session found, redirecting to dashboard');
        navigate("/app/dashboard");
      }
    };
    
    checkExistingSession();
  }, [navigate]);

  // Debug: Log when component mounts
  useEffect(() => {
    console.log("✅ [SIGNUP] Component mounted - Signup page loaded");
    
    // Check for error from OAuth redirect
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      console.error("🔴 [SIGNUP] OAuth error:", errorParam);
    }
  }, [searchParams]);

  const handleGoogleSignup = async () => {
    setLoading(true);
    setError("");

    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/goals`,
        },
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
      }
      // OAuth will redirect, so we don't navigate here
    } catch (err) {
      console.error("Google signup error:", err);
      setError("Failed to sign up with Google. Please try again.");
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("🚀 [SIGNUP] handleSubmit called - form submitted");
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    console.log("🚀 [SIGNUP] Form data extracted:", { email, hasPassword: !!password });

    // Validate email before attempting signup
    console.log("🚀 [SIGNUP] Validating email...");
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      console.error("🔴 [SIGNUP] Email validation failed:", emailValidation.error);
      setError(emailValidation.error || "Invalid email address");
      setLoading(false);
      return;
    }
    console.log("✅ [SIGNUP] Email validation passed");

    try {
      console.log("🚀 [SIGNUP] Calling supabase.auth.signUp...");
      // Sign up with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      console.log("🚀 [SIGNUP] Supabase response:", { 
        hasUser: !!authData?.user, 
        hasSession: !!authData?.session,
        userEmail: authData?.user?.email,
        error: authError?.message 
      });

      if (authError) {
        console.error("🔴 [SIGNUP] Auth error:", authError);
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (!authData.user) {
        console.error("🔴 [SIGNUP] No user returned from Supabase");
        setError("Failed to create account. Please try again.");
        setLoading(false);
        return;
      }

      // Check if email confirmation is required
      if (authData.user && !authData.session) {
        console.log("🟡 [SIGNUP] No session - email confirmation required (but should be disabled)");
        // Email confirmation required
        setEmailConfirmationSent(true);
        setUserEmail(authData.user.email || email);
        setLoading(false);
        return;
      }

      console.log("✅ [SIGNUP] User created with session, proceeding to database...");

      // Create user record in users table with trial plan
      const trialStart = new Date();
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);

      console.log("🚀 [SIGNUP] Creating user in database...");
      const { data: userData, error: dbError } = await supabase.from("users").upsert({
        email: authData.user.email,
        plan: "trial",
        trial_expires_at: trialEnd.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'email'
      });

      if (dbError) {
        console.error("🔴 [SIGNUP] Database error:", dbError);
        console.error("Error details:", {
          message: dbError.message,
          code: dbError.code,
          details: dbError.details,
          hint: dbError.hint
        });
        // Show error to user but don't block signup
        setError(`Account created, but couldn't save to database: ${dbError.message}. Please contact support.`);
      } else {
        console.log("✅ [SIGNUP] User created successfully in database:", userData);
      }

      // Store email in chrome.storage for extension
      if (authData.user?.email) {
        console.log("🚀 [SIGNUP] Storing email in chrome.storage...");
        await storeEmailForExtension(authData.user.email);
      }

      // If we have a session, redirect to goals
      // Otherwise, user needs to confirm email first
      if (authData.session) {
        console.log("✅ [SIGNUP] Session exists, redirecting to /goals");
        navigate("/goals");
      } else {
        console.log("🟡 [SIGNUP] No session (unexpected), showing email confirmation");
        // This shouldn't happen if we handled it above, but just in case
        setEmailConfirmationSent(true);
        setUserEmail(authData.user.email || email);
        setLoading(false);
      }
    } catch (err) {
      console.error("🔴 [SIGNUP] Exception caught:", err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <Link to="/" className="text-2xl font-bold text-primary text-center mb-4 block">
            FocusTube
          </Link>
          <CardTitle className="text-2xl text-center">Create your account</CardTitle>
          <CardDescription className="text-center">
            Start your 14-day free trial
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {emailConfirmationSent ? (
            <Alert className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <AlertTitle className="text-green-900 dark:text-green-100">Check your email</AlertTitle>
              <AlertDescription className="text-green-800 dark:text-green-200">
                We've sent a confirmation link to <strong>{userEmail}</strong>. Click it to verify your account, then come back to sign in.
              </AlertDescription>
              <div className="mt-4">
          <Button
                  variant="outline"
                  className="w-full border-green-500 text-green-700 hover:bg-green-100 dark:text-green-300 dark:hover:bg-green-900/30"
                  onClick={() => navigate("/login")}
                >
                  Already verified? Sign in
                </Button>
              </div>
            </Alert>
          ) : (
            <>
          {/* Google OAuth - Disabled for MVP, will enable later */}
          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignup}
                disabled={loading}
            data-evt="signup_google"
          >
            <Chrome className="mr-2 h-5 w-5" />
                {loading ? "Loading..." : "Continue with Google"}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
            </div>
          </div>

          <form 
            onSubmit={(e) => {
              console.log("🔵 [SIGNUP] Form onSubmit event fired");
              handleSubmit(e);
            }} 
            className="space-y-4"
          >
                {error && (
                  <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="At least 8 characters"
                required
                minLength={8}
              />
            </div>
                <Button type="submit" className="w-full" disabled={loading} data-evt="signup_email">
                  {loading ? "Creating account..." : "Start free trial"}
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground">
            By signing up, you agree to our{" "}
            <Link to="/terms" className="text-primary hover:underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
          </p>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Signup;
