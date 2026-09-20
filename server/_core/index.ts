// Suppress Node.js experimental warnings (e.g. experimental localStorage warning)
const originalEmitWarning = process.emitWarning;
process.emitWarning = ((warning: any, ...args: any[]) => {
  if (
    (typeof warning === "string" && warning.includes("localStorage")) ||
    (typeof warning === "object" && warning?.name === "ExperimentalWarning")
  ) {
    return;
  }
  return (originalEmitWarning as any).call(process, warning, ...args);
}) as any;

import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerGoogleOAuthRoutes } from "./googleOAuth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerChatStream } from "../chatStream";
import { isSupabaseConfigured, supabase } from "../supabase-db";
import { ensureStorageBucket } from "../storage";
import { COOKIE_NAME } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Request, Response } from "express";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

/**
 * Fast, context-free logout handler registered on plain Express — NOT tRPC.
 *
 * The tRPC `auth.logout` procedure goes through `createContext`, which shrugs
 * off the session token and does two Supabase round-trips. When Supabase or
 * the OAuth server is slow, that sign-out request hangs — and the client used
 * to await it before touching the UI, leaving the whole app on a full-screen
 * loading spinner ("sign out is not working at all").
 *
 * This endpoint revokes the session token(s) this request is carrying
 * (Authorization header and/or the HttpOnly cookie) and clears the cookie in
 * pure middleware — no database, no OAuth — so it always succeeds.
 */
function registerLogoutRoute(app: express.Express) {
  const handleLogout = (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const headerToken =
        typeof authHeader === "string" && authHeader.startsWith("Bearer ")
          ? authHeader.slice(7).trim()
          : undefined;
      const cookieToken = parseCookieHeader(
        req.headers.cookie ?? ""
      )[COOKIE_NAME];

      // Revoke every distinct token the request presented, best-effort. A JWT
      // cannot be un-issued, so revoking is what actually de-scopes the session
      // (the cookie clear alone would leave stale tokens working).
      for (const token of new Set(
        [headerToken, cookieToken].filter(Boolean) as string[]
      )) {
        void sdk.revokeSession(token);
      }
    } catch {
      // Best-effort revocation; the cookie is still cleared below.
    }

    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, cookieOptions);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    res.json({ ok: true });
  };

  app.post("/api/auth/logout", handleLogout);
  app.get("/api/auth/logout", handleLogout);
}

function validateProductionConfig() {
  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction) return;

  const problems: string[] = [];
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    problems.push(
      "SUPABASE_SERVICE_ROLE_KEY is not set — Supabase is the required data store in production."
    );
  }
  if (!process.env.SUPABASE_URL?.trim()) {
    problems.push(
      "SUPABASE_URL is not set — the Supabase project URL is required in production."
    );
  }
  if (problems.length > 0) {
    throw new Error(
      `[KSEMO] FATAL: In production, the Supabase-backed persistence layer must be configured.\n  - ${problems.join(
        "\n  - "
      )}`
    );
  }
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "0.0.0.0");
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  validateProductionConfig();
  await ensureStorageBucket();

  const app = express();
  const server = createServer(app);

  // Simple liveness/readiness probe. In Supabase mode it actually touches the
  // database so Render's health check reflects real availability.
  app.get("/api/health", async (_req, res) => {
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("users").select("id").limit(1);
        if (error) {
          res.status(503).json({ ok: false, database: "unavailable" });
          return;
        }
      }
      res.status(200).json({ ok: true });
    } catch {
      res.status(503).json({ ok: false, database: "unavailable" });
    }
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerGoogleOAuthRoutes(app);
  // Plain-Express logout — registered BEFORE the tRPC middleware so it never
  // runs through createContext (which performs Supabase round-trips that can
  // hang a slow sign-out).
  registerLogoutRoute(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  registerChatStream(app);
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const basePort = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const port = process.env.PORT ? basePort : await findAvailablePort(basePort);
  server.listen(port, "0.0.0.0", () => {
    console.log(`\n  ➜  Local:   http://localhost:${port}/\n`);
  });
}

startServer().catch(console.error);
