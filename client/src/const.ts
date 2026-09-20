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
  if (!oauthPortalUrl) {
    window.location.href = "/signin";
    return;
  }
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;

  const nonce = crypto.randomUUID();
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const isSecure = window.location.protocol === "https:";

  // In production (HTTPS), always use Secure. In localhost HTTP, skip Secure flag.
  // Never set a Domain attribute: same-origin apps don't need it, and setting it
  // on PSL hosts like *.onrender.com causes browsers to silently reject the cookie.
  const secure = !isLocal || isSecure;

  document.cookie = `${OAUTH_STATE_COOKIE}=${nonce}; Path=/; Max-Age=600; SameSite=Lax; ${secure ? "Secure;" : ""}`;
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
