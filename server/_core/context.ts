import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../db";
import { sdk } from "./sdk";

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
    console.log("[Context] Authenticating request for:", opts.req.url);
    user = await sdk.authenticateRequest(opts.req);
    console.log("[Context] Authentication result:", user ? "SUCCESS" : "FAILED");
  } catch (error) {
    // Authentication is optional for public procedures.
    console.log("[Context] Authentication error:", String(error));
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
