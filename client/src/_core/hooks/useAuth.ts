import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { setGuestModeActive } from "@/lib/guestMode";
import { getAuthToken } from "@/lib/authHeaders";
import { queryClient } from "@/lib/queryClient";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

// Hard cap on the server side of sign-out. The local transition (storage,
// guest mode, guest UI) is instant and never waits on the network, but we do
// want the server to revoke the session before we wipe the query cache. If the
// server has not answered within this window we stay signed out locally WITHOUT
// clearing the cache — a refetch while a session is still live would re-seed
// the signed-in views.
const LOGOUT_TIMEOUT_MS = 4000;

async function clearServerSession(
  previousToken: string | null
): Promise<boolean> {
  try {
    // Plain-Express endpoint (not tRPC) so no context/Supabase work runs and a
    // slow/hung request can never hold the UI. The captured token rides along
    // as an explicit Authorization header: on PSL hosts (e.g. *.onrender.com)
    // browsers reject HttpOnly cookies, so the header is the ONLY channel a
    // logout request can use to hand the server the session to revoke. Without
    // it the token stays live server-side and any localStorage re-seed (a
    // reload, a second tab resuming the old session) silently logs the user
    // right back in.
    const res = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        ...(previousToken
          ? { authorization: `Bearer ${previousToken}` }
          : {}),
      },
      body: "{}",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function useAuth(options?: UseAuthOptions) {
  // Login is started via startLogin() in the effect below, only when we actually
  // navigate — never during render. startLogin() mints a one-time nonce + writes
  // the state cookie, so calling it per render would overwrite the cookie and
  // desync it from an in-flight login's `state`.
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: 3,
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnWindowFocus: false,
  });

  const logout = useCallback(async () => {
    // 0) Capture the presenting token BEFORE wiping storage, and cancel any
    //    in-flight query. Requests already minted with the old token must not
    //    land after logout and overwrite the signed-out cache with signed-in
    //    data — a straggler response is exactly what appears to "sign the user
    //    back in" seconds later on slow/cookie-less deployments.
    const previousToken = getAuthToken();
    void queryClient.cancelQueries();

    // 1) Destroy every locally-cached credential FIRST. From this instant no
    //    request can still be minted carrying the old token — otherwise a
    //    straggler query (retry, refetch, another tab) would replay it.
    try {
      sessionStorage.removeItem("ksemo-cookie");
      localStorage.removeItem("ksemo-cookie");
      sessionStorage.removeItem("ksemo-token");
      localStorage.removeItem("ksemo-token");
      localStorage.removeItem("ksemo-user-info");
    } catch {}

    // 2) Strip any leftover `#_t=<token>` from the URL (e.g. an interrupted
    //    OAuth redirect). main.tsx re-seeds storage from that hash on every
    //    reload, which would silently undo this sign-out.
    try {
      const url = new URL(window.location.href);
      if (url.hash.startsWith("#_t=")) {
        url.hash = "";
        window.history.replaceState(null, "", url.pathname + url.search);
      }
    } catch {}

    // 3) The session is now over from the client's point of view. Any 401 that
    //    fires while the guest UI settles must not bounce the user to the
    //    sign-in screen (the stale queries still in the cache can briefly error).
    setGuestModeActive(true);

    // 4) Flip the signed-in UI to the guest UI IMMEDIATELY. The server call
    //    below must never gate this transition — awaiting the network here is
    //    exactly what used to keep the whole app on a full-screen loading
    //    spinner (and until a slow/hung request resolved, it genuinely looked
    //    like "sign out is not working at all").
    utils.auth.me.setData(undefined, null);

    // 5) Ask the server to revoke the session (via the captured token + any
    //    HttpOnly cookie) and clear the cookie. Wait only briefly: a slow or
    //    hung request must never block the UI.
    const serverCleared = await Promise.race([
      clearServerSession(previousToken),
      new Promise<boolean>(resolve =>
        setTimeout(() => resolve(false), LOGOUT_TIMEOUT_MS)
      ),
    ]);

    if (serverCleared) {
      // 6a) Server confirmed: session revoked + cookie cleared. Wipe every
      //     cached query so no stale signed-in data survives the logout
      //     (conversations, preferences, user object, …), then re-check `me`
      //     — which now returns null.
      queryClient.clear();
      await utils.auth.me.invalidate().catch(() => {});
    } else {
      // 6b) Server unreachable: the session may still be live and any in-flight
      //     refetch would travel with it and re-seed signed-in views. Keep the
      //     local guest state and leave the cache untouched. (The next
      //     successful logout/sign-in cycle revokes it server-side.)
    }
  }, [utils]);

  /**
   * True only when the server answered "no session" (auth.me returned null).
   * A network/server/database error is NOT signed-out: showing the sign-in
   * screen then would wipe the user's perceived session on a transient outage.
   */
  const definitelySignedOut = meQuery.isSuccess && !meQuery.data;

  const authUnavailable =
    Boolean(meQuery.error) ||
    (meQuery.isError && !definitelySignedOut);

  const state = useMemo(() => {
    return {
      user: meQuery.data ?? null,
      // `logoutMutation.isPending` deliberately does NOT count as loading:
      // sign-out flips the app to the guest UI via setData(null) instantly, and
      // treating the in-flight sign-out request as "loading" would unmount the
      // whole app to a full-screen spinner until the network answers.
      loading: meQuery.isLoading,
      error: meQuery.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
      definitelySignedOut,
      authUnavailable,
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    definitelySignedOut,
    authUnavailable,
  ]);

  useEffect(() => {
    localStorage.setItem("ksemo-user-info", JSON.stringify(meQuery.data));
  }, [meQuery.data]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    // During an outage we cannot tell signed-in from signed-out, so never boot
    // the user out of the app to the login flow.
    if (authUnavailable) return;
    if (meQuery.isLoading) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (redirectPath && window.location.pathname === redirectPath) return;

    // Navigate at this moment only. startLogin() mints the nonce + cookie itself.
    if (redirectPath) {
      window.location.href = redirectPath;
    } else {
      startLogin();
    }
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    meQuery.isLoading,
    state.user,
    authUnavailable,
  ]);

  const refresh = useCallback(() => meQuery.refetch(), [meQuery]);

  return {
    ...state,
    refresh,
    logout,
  };
}