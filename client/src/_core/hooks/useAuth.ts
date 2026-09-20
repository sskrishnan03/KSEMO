import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { setGuestModeActive } from "@/lib/guestMode";
import { queryClient } from "@/lib/queryClient";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

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

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
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
    // The session is now over from the client's point of view. Any 401 that
    // fires while the guest UI settles must not bounce the user to the
    // sign-in screen (the stale queries still in the cache can briefly error).
    setGuestModeActive(true);

    let serverClearedSession = false;
    try {
      await logoutMutation.mutateAsync();
      serverClearedSession = true;
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        // Already signed out server-side.
        serverClearedSession = true;
      }
      // Any other failure: the HttpOnly cookie may not have been cleared by
      // the server. Never throw — the user must still be brought back to the
      // guest UI instead of being trapped in a half-logged-out state.
    } finally {
      if (serverClearedSession) {
        // The server cleared the cookie AND revoked the token. Wipe every
        // cached query so no stale signed-in data survives the logout
        // (conversations, preferences, user object, …), then re-check `me`.
        queryClient.clear();
        await utils.auth.me.invalidate();
      } else {
        // Server unreachable: the HttpOnly cookie may still be valid and
        // in-flight refetches would travel with it and instantly re-auth.
        // Do NOT clear/invalidate — just drop the user in place so the UI
        // lands on the guest screen. (The next successful logout/sign-in
        // cycle revokes the session properly server-side.)
        utils.auth.me.setData(undefined, null);
      }
    }
  }, [logoutMutation, utils]);

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
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
      definitelySignedOut,
      authUnavailable,
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
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
    if (meQuery.isLoading || logoutMutation.isPending) return;
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
    logoutMutation.isPending,
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