const isProduction = process.env.NODE_ENV === "production";

// In production, JWT_SECRET MUST be an explicitly-configured stable secret.
// A missing or randomly-generated secret invalidates every user session on
// every restart/redeploy, so the server must fail clearly instead.
if (isProduction && !process.env.JWT_SECRET?.trim()) {
  throw new Error(
    "[KSEMO] FATAL: JWT_SECRET is not set in production. " +
      "Set a stable JWT_SECRET (e.g. in Render) to keep user sessions valid " +
      "across restarts and redeploys."
  );
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "ksemo-app",
  cookieSecret:
    process.env.JWT_SECRET ||
    "ksemo-session-secret-key-32-chars-minimum-fallback-dev-only!!",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction,
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
