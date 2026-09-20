import { QueryClient } from "@tanstack/react-query";

/**
 * The single global QueryClient. Defined here (instead of inside main.tsx) so
 * the auth hook can wipe every cached query on logout — otherwise stale
 * signed-in data can linger in the cache and re-render as "logged in" after
 * the session has ended.
 */
export const queryClient = new QueryClient();