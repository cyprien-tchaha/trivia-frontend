"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";

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

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setHost(data);
    } catch {
      setHost(null);
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
      await api.post("/auth/logout");
    } catch {
      // Clearing the cookie is the API's job; if that call fails there is
      // nothing useful to do locally, so drop the state and move on.
    }
    setHost(null);
    window.location.href = "/";
  }, []);

  return { host, loading, signIn, signOut, refresh };
}
