import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { setGuestModeActive } from "@/lib/guestMode";
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
// clearing the cache — a refetch while the HttpOnly cookie is still live would
// instantly re-authenticate the user.
const LOGOUT_TIMEOUT_MS = 4000;

async function clearServerSession(): Promise<boolean> {
  try {
    // Plain-Express endpoint (not tRPC) so no context/Supabase work runs.
    // `credentials: "include"` guarantees the HttpOnly cookie rides along,
    // which is exactly the token the server revokes + clears.
    const res = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
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

    // 2) The session is now over from the client's point of view. Any 401 that
    //    fires while the guest UI settles must not bounce the user to the
    //    sign-in screen (the stale queries still in the cache can briefly error).
    setGuestModeActive(true);

    // 3) Flip the signed-in UI to the guest UI IMMEDIATELY. The server call
    //    below must never gate this transition — awaiting the network here is
    //    exactly what used to keep the whole app on a full-screen loading
    //    spinner (and until a slow/hung request resolved, it genuinely looked
    //    like "sign out is not working at all").
    utils.auth.me.setData(undefined, null);

    // 4) Ask the server to revoke the session and clear the HttpOnly cookie.
    //    This request still rides on that cookie (the Authorization header is
    //    already gone), so the presenting token is always found and revoked.
    //    Wait only briefly: a slow or hung request must never block the UI.
    const serverCleared = await Promise.race([
      clearServerSession(),
      new Promise<boolean>(resolve =>
        setTimeout(() => resolve(false), LOGOUT_TIMEOUT_MS)
      ),
    ]);

    if (serverCleared) {
      // 5a) Server confirmed: cookie cleared + token revoked. Wipe every
      //     cached query so no stale signed-in data survives the logout
      //     (conversations, preferences, user object, …), then re-check `me`
      //     — which now returns null.
      queryClient.clear();
      await utils.auth.me.invalidate().catch(() => {});
    } else {
      // 5b) Server unreachable: the HttpOnly cookie may still be valid and any
      //     in-flight refetch would travel with it and instantly re-auth.
      //     Keep the local guest state and leave the cache untouched. (The
      //     next successful logout/sign-in cycle revokes the session properly
      //     server-side.)
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