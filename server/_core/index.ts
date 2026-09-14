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
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerChatStream } from "../chatStream";
import { isSupabaseConfigured, supabase } from "../supabase-db";

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
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
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
  registerOAuthRoutes(app);
  registerGoogleOAuthRoutes(app);
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

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  server.listen(port, "0.0.0.0", () => {
    console.log(`\n  ➜  Local:   http://localhost:${port}/\n`);
  });
}

startServer().catch(console.error);
