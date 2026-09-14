import { COOKIE_NAME } from "@shared/const";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { DatabaseUnavailableError } from "../supabase-db";
import type { User } from "../supabase-db";
import { sdk, SessionLookupError } from "./sdk";
import { getSessionCookieOptions } from "./cookies";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  /**
   * True when the request carried a plausible-but-unverifiable session and the
   * failure was an infrastructure problem (database or OAuth server down),
   * not a logged-out user. The session cookie is preserved in this state so a
   * transient outage never forces users to sign in again.
   */
  authUnavailable: boolean;
};

function isInfraFailure(error: unknown): boolean {
  return error instanceof DatabaseUnavailableError ||
    error instanceof SessionLookupError;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let authUnavailable = false;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    if (isInfraFailure(error)) {
      // Database/OAuth outage. KEEP the session cookie: the client stays
      // signed in and can retry. Do not let a transient outage look like a
      // logout.
      authUnavailable = true;
      console.error(
        "[auth] Session verification failed due to infrastructure issue; " +
          "session cookie preserved:",
        error instanceof Error ? error.message : error
      );
    } else {
      // Any other error is treated as an invalid session and cleared.
      try {
        const cookieOptions = getSessionCookieOptions(opts.req);
        opts.res.clearCookie(COOKIE_NAME, cookieOptions);
      } catch {
        // Cookie clearing is best-effort.
      }
    }
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    authUnavailable,
  };
}