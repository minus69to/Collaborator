import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type AuthState = {
  status: "loading" | "authenticated" | "unauthenticated";
  user: User | null;
};

export function useUser() {
  const [state, setState] = useState<AuthState>({ status: "loading", user: null });
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getUser().then(({ data, error }) => {
      if (!isMounted) return;

      if (error || !data.user) {
        setState({ status: "unauthenticated", user: null });
      } else {
        setState({ status: "authenticated", user: data.user });
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;

      if (session?.user) {
        setState({ status: "authenticated", user: session.user });
      } else {
        setState({ status: "unauthenticated", user: null });
      }
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  return state;
}

