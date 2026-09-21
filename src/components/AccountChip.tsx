"use client";

import { useState } from "react";
import { C, DISPLAY } from "@/lib/theme";
import { useAuth } from "@/lib/useAuth";

/**
 * Sign-in control and account badge.
 *
 * Renders nothing while the session is still being checked, rather than
 * flashing "Sign in" at a host who is already signed in — that flicker reads
 * as being logged out.
 */
export default function AccountChip() {
  const { host, loading, signIn, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  if (loading) {
    return <div style={{ height: "40px" }} aria-hidden />;
  }

  if (!host) {
    return (
      <button
        onClick={signIn}
        className="btn-3d"
        style={{
          display: "inline-flex", alignItems: "center", gap: "8px",
          padding: "10px 18px", borderRadius: "999px", border: "none",
          background: "#FFFFFF", color: "#5B21C6",
          fontFamily: DISPLAY, fontWeight: 600, fontSize: "14px",
          cursor: "pointer", boxShadow: "0 4px 0 #CBB8F0",
          ["--btn-edge" as string]: "#CBB8F0",
        }}
      >
        <GoogleMark />
        Sign in
      </button>
    );
  }

  const label = host.name || host.email;
  const initial = (label || "?").trim().charAt(0).toUpperCase();

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Account: ${label}`}
        style={{
          display: "inline-flex", alignItems: "center", gap: "10px",
          padding: "6px 14px 6px 6px", borderRadius: "999px",
          background: "rgba(23,4,56,0.34)", border: "1px solid rgba(255,255,255,0.22)",
          color: "#FFFFFF", cursor: "pointer", fontFamily: DISPLAY,
          fontWeight: 600, fontSize: "14px",
        }}
      >
        {host.picture_url ? (
          /* Google's avatar CDN, not a project asset. next/image would need a
             remotePatterns entry and an optimisation round-trip for a 28px
             image that is already the right size. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={host.picture_url}
            alt=""
            width={28}
            height={28}
            style={{ borderRadius: "50%", display: "block" }}
            referrerPolicy="no-referrer"
          />
        ) : (
          <span style={{
            width: "28px", height: "28px", borderRadius: "50%",
            background: C.accent, color: "#3B1A00",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: "13px",
          }}>{initial}</span>
        )}
        <span style={{ maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
        {host.plan === "pro" && (
          <span style={{
            padding: "2px 8px", borderRadius: "999px", background: C.accent,
            color: "#3B1A00", fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em",
          }}>PRO</span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 50,
          minWidth: "200px", padding: "8px", borderRadius: "16px",
          background: C.surface, border: `1px solid ${C.border}`,
          boxShadow: "0 12px 28px rgba(23,4,56,0.45)",
        }}>
          <div style={{ padding: "8px 10px", fontSize: "12px", color: C.muted, wordBreak: "break-all" }}>
            {host.email}
          </div>
          <button
            onClick={signOut}
            style={{
              width: "100%", textAlign: "left", padding: "10px",
              borderRadius: "10px", border: "none", background: "transparent",
              color: "#FFFFFF", cursor: "pointer", fontFamily: DISPLAY,
              fontWeight: 600, fontSize: "14px",
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.3 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.6 5.9c4.4-4.1 6.7-10.1 6.7-17.2z" />
      <path fill="#FBBC05" d="M10.4 28.7c-.5-1.5-.8-3.1-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C.9 16.3 0 20 0 24s.9 7.7 2.6 10.8l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.4 0-11.7-3.8-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
