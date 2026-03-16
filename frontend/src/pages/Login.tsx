import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Chrome as ChromeIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { storeEmailForExtension } from "@/lib/extensionStorage";
import { validateEmail } from "@/lib/emailValidation";

// Type declaration for Chrome extension API
declare const chrome: any;

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const returnToExtension = searchParams.get('return') === 'extension';

  // Check for existing valid session on page load
  useEffect(() => {
    const checkExistingSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      // If there's a valid session and no error, redirect to dashboard
      if (session && !error) {
        console.log('[Login] Valid session found, redirecting to dashboard');
        navigate("/app/dashboard");
      }
    };
    
    // Only check on initial page load (no hash fragment)
    if (!window.location.hash) {
      checkExistingSession();
    }
  }, [navigate]);

  // Handle OAuth callback - check if user just logged in via OAuth
  useEffect(() => {
    const checkSession = async () => {
      // Only process OAuth callback if there's a hash fragment (OAuth redirect)
      // This prevents interfering with normal email/password login
      if (!window.location.hash) {
        console.log('[OAuth] No hash fragment - skipping OAuth check (normal page load)');
        return;
      }
      
      console.log('[OAuth] Step 1: Session check started (OAuth redirect detected)');
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        console.log('[OAuth] Step 2: Session found:', session.user.email);
        await storeEmailForExtension(session.user.email);

        // Ensure OAuth users exist in users table
        let isNewOAuthUser = false;
        let userPlan = "free";

        console.log('[OAuth] Step 3: Checking if user exists...');
        const { data: existingUsers, error: existingUserError } = await supabase
          .from("users")
          .select("email, plan")
          .eq("email", session.user.email)
          .limit(1);

        if (existingUserError) {
          console.error("[OAuth] Error checking users row after OAuth login:", existingUserError);
        } else {
          console.log('[OAuth] Step 4: User exists:', (existingUsers?.length ?? 0) > 0);
        }

        if (!existingUserError && (!existingUsers || existingUsers.length === 0)) {
          console.log('[OAuth] Step 5: Creating NEW user (first time OAuth signup)...');
          
          // Validate email before creating user (block disposable emails)
          const emailValidation = validateEmail(session.user.email || '');
          if (!emailValidation.isValid) {
            console.error('[OAuth] Email validation failed:', emailValidation.error);
            // Sign out the user since we can't use this email
            await supabase.auth.signOut();
            // Redirect to signup with error
            navigate('/signup?error=' + encodeURIComponent(emailValidation.error || 'Invalid email'));
            return;
          }
          
          const trialStart = new Date();
          const trialExpires = new Date(trialStart);
          trialExpires.setDate(trialExpires.getDate() + 14);

          const { error: insertUserError } = await supabase.from("users").insert({
            email: session.user.email,
            plan: "trial",
            trial_expires_at: trialExpires.toISOString(),
          });

          if (insertUserError) {
            console.error("[OAuth] Error creating users row after OAuth login:", insertUserError);
          } else {
            console.log('[OAuth] Step 6: User created successfully - THIS IS A NEW USER');
            isNewOAuthUser = true;
            userPlan = "trial";
          }
        } else if (!existingUserError) {
          console.log('[OAuth] Step 5: User already exists - RETURNING USER');
          userPlan = existingUsers[0]?.plan || "free";
          isNewOAuthUser = false;
        }

        // Sync owner email + plan to extension storage when available
        console.log('[OAuth] Step 7: Syncing to extension...');
        if (typeof chrome !== 'undefined' && (chrome as any).storage) {
          (chrome as any).storage.local.set({
            ft_data_owner_email: session.user.email,
            ft_plan: userPlan,
          });
        } else {
          console.log('[OAuth] chrome.storage not available (expected outside extension context)');
        }
        
        // If coming from extension, close tab after delay
        if (returnToExtension) {
          console.log('[OAuth] Step 8: Returning to extension - closing tab in 2s');
          setTimeout(() => {
            window.close();
          }, 2000);
        } else {
          const path = isNewOAuthUser ? "/goals" : "/app/dashboard";
          console.log('[OAuth] Step 8: isNewOAuthUser =', isNewOAuthUser);
          console.log('[OAuth] Step 8: Navigating to:', path);
          navigate(path);
        }
      } else {
        console.log('[OAuth] Step 2: No session found - user not logged in yet');
      }
    };
    checkSession();
  }, [navigate, returnToExtension]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");

    try {
      const redirectUrl = returnToExtension 
        ? `${window.location.origin}/login?return=extension`
        : `${window.location.origin}/login`;

      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
      }
    } catch (err) {
      console.error("Google login error:", err);
      setError("Failed to login with Google. Please try again.");
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
  
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
  
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
  
      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }
      
      // Get session and fetch user plan BEFORE navigating
      const { data: { session } } = await supabase.auth.getSession();
      let userPlan = "free";
      
      if (session?.user?.email) {
        // Store email for extension helper
        await storeEmailForExtension(session.user.email);
        
        const { data: userRows, error: userRowsError } = await supabase
          .from("users")
          .select("plan")
          .eq("email", session.user.email)
          .limit(1);
  
        if (!userRowsError && userRows?.[0]) {
          userPlan = userRows[0].plan;
        }
      }
      
      // Store in extension storage with correct plan
      if (typeof chrome !== 'undefined' && (chrome as any).storage) {
        (chrome as any).storage.local.set({
          ft_data_owner_email: session?.user?.email || email,
          ft_plan: userPlan,
        });
      }
  
      // If coming from extension, show success and close
      if (returnToExtension) {
        setError("");
        setTimeout(() => {
          try {
            window.close();
          } catch (e) {
            console.log("Could not close window (not opened by extension)");
          }
        }, 1500);
        return;
      }
  
      // Navigate to dashboard AFTER everything is set up
      navigate("/app/dashboard");
      
    } catch (err) {
      console.error("Login error:", err);
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
          <CardTitle className="text-2xl text-center">Welcome back</CardTitle>
          <CardDescription className="text-center">
            Sign in to access your dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Google OAuth - Disabled for MVP, will enable later */}
          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleLogin}
            disabled={loading}
            data-evt="login_google"
          >
            <ChromeIcon className="mr-2 h-5 w-5" />
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

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-sm text-red-500 text-center">{error}</div>
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  to="/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  Forgot?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading} data-evt="login_email">
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/signup" className="text-primary hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
