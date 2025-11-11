import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

/**
 * Shared auth guard hook that waits for Supabase to restore persisted sessions.
 * Returns the current auth status so pages can decide what to render.
 */
export function useRequireAuth(): AuthStatus {
  const navigate = useNavigate();
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let isMounted = true;

    // Kick off a session check so we update quickly if a cached session exists.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted || status !== "loading") return;
      if (session) {
        setStatus("authenticated");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === "INITIAL_SESSION") {
        if (session) {
          setStatus("authenticated");
        } else {
          setStatus("unauthenticated");
          navigate("/login", { replace: true });
        }
      } else if (event === "SIGNED_IN") {
        setStatus("authenticated");
      } else if (event === "SIGNED_OUT") {
        setStatus("unauthenticated");
        navigate("/login", { replace: true });
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, status]);

  return status;
}

