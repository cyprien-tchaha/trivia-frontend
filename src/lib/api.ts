import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api",
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
  // Deliberately NOT withCredentials here. Setting it globally makes the
  // browser demand Access-Control-Allow-Credentials with a specific origin on
  // *every* request — so the moment the API answers with a wildcard origin,
  // creating a game fails too, not just signing in. The frontend and the API
  // deploy separately, so the two cannot be assumed to be in step.
  //
  // Only the auth calls need the cookie, and they opt in per-request via
  // withAuth() below.
});

/** Per-request config for calls that must carry the session cookie. */
export const withAuth = { withCredentials: true } as const;

export default api;