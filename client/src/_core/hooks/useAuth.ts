import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
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
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      // Clear the auto-login token mirrored into sessionStorage, so
      // header-based sessions are logged out too. The backend cookie is cleared by the logout mutation.
      try {
        sessionStorage.removeItem("ksemo-cookie");
        localStorage.removeItem("ksemo-cookie");
        sessionStorage.removeItem("ksemo-token");
        localStorage.removeItem("ksemo-token");
        localStorage.removeItem("ksemo-user-info");
      } catch {}
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
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