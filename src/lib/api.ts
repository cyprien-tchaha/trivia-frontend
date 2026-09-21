import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api",
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
  // The host session is an HttpOnly cookie set by the API on a different
  // origin. Without this the browser withholds it and every authenticated
  // request looks signed-out. The API must answer with an explicit origin and
  // Access-Control-Allow-Credentials — a wildcard will not do.
  withCredentials: true,
});

export default api;