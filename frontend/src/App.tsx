import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import Home from "./pages/Home";
import Pricing from "./pages/Pricing";
import Download from "./pages/Download";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Goals from "./pages/Goals";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound";
import { supabase } from "@/lib/supabase";

const queryClient = new QueryClient();

// Inner component that has access to useNavigate
const AppRoutes = () => {
  const navigate = useNavigate();

  // Listen for logout messages from extension
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Only accept messages from same origin (security)
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data && event.data.type === 'FT_LOGOUT_FROM_EXTENSION') {
        console.log('🔓 Extension requested logout, signing out from Supabase...');
        
        try {
          // Sign out from Supabase
          const { error } = await supabase.auth.signOut();
          
          if (error) {
            console.error('Error signing out:', error);
            return;
          }

          // Redirect to login
          navigate('/login');
          console.log('✅ Signed out and redirected to login');
        } catch (err) {
          console.error('Error handling extension logout:', err);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate]);

  return (
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/download" element={<Download />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
      <Route path="/goals" element={<Goals />} />
          <Route path="/app/dashboard" element={<Dashboard />} />
          <Route path="/app/settings" element={<Settings />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
