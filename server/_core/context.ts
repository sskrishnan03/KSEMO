import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../supabase-db";
import { sdk } from "./sdk";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    try {
      const cookieOptions = getSessionCookieOptions(opts.req);
      opts.res.clearCookie(COOKIE_NAME, cookieOptions);
    } catch {}
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
