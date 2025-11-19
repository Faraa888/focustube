import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { Menu, LogOut } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import { removeEmailFromExtension } from "@/lib/extensionStorage";
import { toast } from "@/hooks/use-toast";

const Header = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Check auth status
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
      setUserEmail(session?.user?.email ?? null);
      setLoading(false);
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      setUserEmail(session?.user?.email ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      // Clear Supabase session
      const { error: signOutError } = await supabase.auth.signOut();
      
      if (signOutError) {
        console.error("Logout error:", signOutError);
        toast({
          title: "Error",
          description: "Failed to log out. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Clear chrome.storage (for extension)
      await removeEmailFromExtension();

      // Redirect to login
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

  return (
    <header className="fixed top-0 w-full z-50 bg-background/95 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="text-2xl font-bold text-primary hover:opacity-80 transition-opacity">
          FocusTube
        </Link>
        
        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Link to="/" className="text-foreground hover:text-primary transition-colors text-sm font-medium">
            Home
          </Link>
          <Link to="/pricing" className="text-foreground hover:text-primary transition-colors text-sm font-medium">
            Pricing
          </Link>
          <Link to="/download" className="text-foreground hover:text-primary transition-colors text-sm font-medium">
            Download
          </Link>
          {!loading && (
            isAuthenticated ? (
              <>
                <Link to="/app/dashboard" className="text-foreground hover:text-primary transition-colors text-sm font-medium">
                  Dashboard
                </Link>
                <Link to="/app/settings" className="text-foreground hover:text-primary transition-colors text-sm font-medium">
                  Settings
                </Link>
                {isAuthenticated && userEmail && (
                  <span className="text-sm text-muted-foreground font-medium">
                    Logged in as <span className="text-primary">{userEmail}</span>
                  </span>
                )}
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleLogout}
                  className="text-foreground hover:text-primary flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </>
            ) : (
          <Link to="/login" className="text-foreground hover:text-primary transition-colors text-sm font-medium">
            Login
          </Link>
            )
          )}
        </nav>

        <div className="flex items-center gap-4">
          {!loading && !isAuthenticated && (
          <Button asChild className="hidden md:inline-flex" data-evt="header_cta">
            <Link to="/signup">Start Free Trial</Link>
          </Button>
          )}
          
          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <nav className="flex flex-col gap-4 mt-8">
                <Link to="/" className="text-lg font-medium hover:text-primary transition-colors">
                  Home
                </Link>
                <Link to="/pricing" className="text-lg font-medium hover:text-primary transition-colors">
                  Pricing
                </Link>
                <Link to="/download" className="text-lg font-medium hover:text-primary transition-colors">
                  Download
                </Link>
                {!loading && (
                  isAuthenticated ? (
                    <>
                      <Link to="/app/dashboard" className="text-lg font-medium hover:text-primary transition-colors">
                        Dashboard
                      </Link>
                      <Link to="/app/settings" className="text-lg font-medium hover:text-primary transition-colors">
                        Settings
                      </Link>
                      {isAuthenticated && userEmail && (
                        <p className="text-sm text-muted-foreground font-medium">
                          Logged in as <span className="text-primary">{userEmail}</span>
                        </p>
                      )}
                      
                      
                      <Button 
                        variant="outline" 
                        onClick={handleLogout}
                        className="mt-4 w-full flex items-center justify-center gap-2"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </Button>
                    </>
                  ) : (
                    <>
                <Link to="/login" className="text-lg font-medium hover:text-primary transition-colors">
                  Login
                </Link>
                <Button asChild className="mt-4" data-evt="mobile_menu_cta">
                  <Link to="/signup">Start Free Trial</Link>
                </Button>
                    </>
                  )
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Header;
