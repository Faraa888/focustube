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
      if (!isMounted) return;
      if (session) {
        setStatus("authenticated");
      }
      // Don't set unauthenticated here - wait for INITIAL_SESSION to confirm
      // This prevents race conditions where INITIAL_SESSION hasn't fired yet
    });

    // Set a timeout to handle cases where INITIAL_SESSION doesn't fire
    // (shouldn't happen, but safety net)
    const timeoutId = setTimeout(() => {
      if (!isMounted) return;
      // If still loading after 3 seconds, check session again
      if (status === "loading") {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!isMounted) return;
          if (session) {
            setStatus("authenticated");
          } else {
            setStatus("unauthenticated");
            navigate("/login", { replace: true });
          }
        });
      }
    }, 3000);

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
      clearTimeout(timeoutId);
    };
  }, [navigate, status]);

  return status;
}

