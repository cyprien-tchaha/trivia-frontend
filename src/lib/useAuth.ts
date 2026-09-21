"use client";

import { useCallback, useEffect, useState } from "react";
import api, { withAuth } from "@/lib/api";

export type Host = {
  id: string;
  email: string;
  name: string | null;
  picture_url: string | null;
  plan: "free" | "pro";
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

/**
 * The signed-in host, or null.
 *
 * Signed-out is a normal state, not an error: hosting anonymously is the free
 * tier, so a 401 here means "no account", never "something broke". Nothing in
 * the app should block on this resolving.
 */
export function useAuth() {
  const [host, setHost] = useState<Host | null>(null);
  const [loading, setLoading] = useState(true);
  // Whether the API has Google credentials at all. Offering a sign-in button
  // that cannot work means the host finds out by being redirected to an
  // error, so the control hides itself instead.
  const [signInAvailable, setSignInAvailable] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [meResult, configResult] = await Promise.allSettled([
        api.get("/auth/me", withAuth),
        api.get("/auth/config"),
      ]);
      setHost(meResult.status === "fulfilled" ? meResult.value.data : null);
      setSignInAvailable(
        configResult.status === "fulfilled" && !!configResult.value.data?.google_enabled,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // A full navigation, not an XHR: the OAuth flow has to leave the app and
  // come back, and the API sets the session cookie on the redirect.
  const signIn = useCallback(() => {
    window.location.href = `${API_BASE}/auth/google/start`;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.post("/auth/logout", null, withAuth);
    } catch {
      // Clearing the cookie is the API's job; if that call fails there is
      // nothing useful to do locally, so drop the state and move on.
    }
    setHost(null);
    window.location.href = "/";
  }, []);

  return { host, loading, signInAvailable, signIn, signOut, refresh };
}
