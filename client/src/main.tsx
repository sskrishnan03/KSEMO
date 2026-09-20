import { trpc } from "@/lib/trpc";
import { COOKIE_NAME, UNAUTHED_ERR_MSG } from "@shared/const";
import { QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { startLogin } from "./const";
import "./index.css";
import { getAuthHeaders } from "./lib/authHeaders";
import { isGuestModeActive } from "./lib/guestMode";
import { queryClient } from "./lib/queryClient";
import { initTouchHover } from "./lib/touchHover";

initTouchHover();

/**
 * Google OAuth (and generic OAuth) callbacks redirect to /#_t=<sessionToken>
 * so the client can extract and persist the token in localStorage without
 * the server needing to expose it through any other channel.
 *
 * We do this as early as possible (before React hydrates) so the very first
 * trpc/auth.me query already has the token available in getAuthHeaders().
 *
 * The hash is cleared immediately afterwards — it must not appear in browser
 * history, be sent to analytics, or leak via Referer headers.
 */
function extractSessionTokenFromHash() {
  try {
    const hash = window.location.hash;
    if (!hash.startsWith("#_t=") && !hash.includes("_t=")) return;

    const params = new URLSearchParams(hash.slice(1));
    const token = params.get("_t");
    if (!token) return;

    const COOKIE_VALUE = `${COOKIE_NAME}=${token}`;
    sessionStorage.setItem("ksemo-token", token);
    localStorage.setItem("ksemo-token", token);
    sessionStorage.setItem("ksemo-cookie", COOKIE_VALUE);
    localStorage.setItem("ksemo-cookie", COOKIE_VALUE);

    // Remove the token hash from the URL immediately so it isn't visible
    // in browser history, analytics tools, or Referer headers.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  } catch {
    // Storage or history API unavailable — silently continue.
  }
}

extractSessionTokenFromHash();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;
  // Signed-out guests wander the app without a session; a stray 401 from any
  // leftover query must never force them onto the login screen.
  if (isGuestModeActive()) return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  startLogin();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        return getAuthHeaders();
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
