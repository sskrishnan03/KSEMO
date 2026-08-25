import { OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";

// Start the hosted OAuth portal login. Call this from an event handler or effect at the
// moment you want to navigate, e.g. `onClick={() => startLogin()}`.
//
// It has SIDE EFFECTS — it mints a one-time nonce, writes the __Host- state
// cookie, and navigates immediately — so the cookie nonce always matches the
// `state` it sends. Do NOT call it during render (no `href={startLogin()}` /
// `loginUrl={...}`): each call overwrites the cookie, so a stray render-phase
// call would desync it from an in-flight login and the callback would reject it
// with "invalid oauth state". It returns void by design, so there is no URL to
// stash across renders.
export const startLogin = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;

  const nonce = crypto.randomUUID();
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const isSecure = window.location.protocol === "https:";
  const isIpAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(window.location.hostname) || window.location.hostname.includes(":");
  
  // Set domain for production environments (only for valid domain names, not IPs)
  const domain = (!isLocal && !isIpAddress) ? ` domain=.${window.location.hostname};` : "";
  
  // In production (HTTPS), always use Secure. In localhost HTTP, skip Secure flag
  const sameSite = isLocal ? "Lax" : "None";
  const secure = !isLocal || isSecure; // Secure in production or HTTPS localhost
  
  document.cookie = `${OAUTH_STATE_COOKIE}=${nonce}; Path=/; Max-Age=600;${domain} SameSite=${sameSite}; ${secure ? "Secure;" : ""}`;
  const state = encodeOAuthState({ redirectUri, nonce });

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  window.location.href = url.toString();
};

// Start direct Google OAuth sign-in. The server mints the CSRF state cookie
// and redirects to Google's consent screen, so this is safe to call from any
// event handler.
export const startGoogleLogin = () => {
  window.location.href = "/api/auth/google";
};
