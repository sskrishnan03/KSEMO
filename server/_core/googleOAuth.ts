import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import axios from "axios";
import type { Express, Request, Response } from "express";
import { randomUUID } from "crypto";
import * as db from "../supabase-db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

const STATE_COOKIE = "google_oauth_state";

function googleCredentials() {
  const clientId =
    process.env.GOOGLE_CLIENT_ID ?? process.env.VITE_GOOGLE_CLIENT_ID ?? "";
  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET ??
    process.env.VITE_GOOGLE_CLIENT_SECRET ??
    "";
  return { clientId, clientSecret };
}

export function isGoogleOAuthConfigured(): boolean {
  const { clientId, clientSecret } = googleCredentials();
  return clientId.length > 0 && clientSecret.length > 0;
}

function callbackUrl(req: Request): string {
  // Allow override via environment variable for Render/deployed environments
  const override = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (override) {
    return override;
  }
  const url = `${req.protocol}://${req.get("host")}/api/auth/google/callback`;
  return url;
}

export function registerGoogleOAuthRoutes(app: Express) {
  // Starts the Google sign-in: redirects the browser to Google's consent screen.
  app.get("/api/auth/google", (req: Request, res: Response) => {
    const { clientId, clientSecret } = googleCredentials();
    if (!clientId || !clientSecret) {
      res.status(500).json({
        error:
          "Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_CLIENT_SECRET.",
      });
      return;
    }

    const nonce = randomUUID();
    // For local development, use less strict cookie settings
    const isLocal = req.hostname === "localhost" || req.hostname === "127.0.0.1";
    
    // Simplified cookie settings for better compatibility
    res.cookie(STATE_COOKIE, nonce, {
      httpOnly: true,
      path: "/",
      sameSite: "lax", // Use lax for better compatibility
      secure: !isLocal, // Only require secure for production
      maxAge: 10 * 60 * 1000,
    });

    const url = new URL(GOOGLE_AUTH_URL);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", callbackUrl(req));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", nonce);
    url.searchParams.set("prompt", "select_account");

    res.redirect(302, url.toString());
  });

  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const code =
      typeof req.query.code === "string" ? req.query.code : undefined;
    const state =
      typeof req.query.state === "string" ? req.query.state : undefined;
    const error =
      typeof req.query.error === "string" ? req.query.error : undefined;

    if (error) {
      res.status(400).json({ error: `Google sign-in was cancelled: ${error}` });
      return;
    }
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    // CSRF guard: `state` must match the one-time cookie set when login started.
    const cookies = req.headers.cookie ?? "";
    const expectedState = cookies
      .split(";")
      .map(c => c.trim())
      .find(part => part.startsWith(`${STATE_COOKIE}=`))
      ?.slice(STATE_COOKIE.length + 1);
    const isLocal = req.hostname === "localhost" || req.hostname === "127.0.0.1";
    
    res.clearCookie(STATE_COOKIE, { 
      path: "/",
      sameSite: "lax",
      secure: !isLocal
    });
    
    if (!expectedState || state !== expectedState) {
      console.error("[Google OAuth] State mismatch - received:", state, "expected:", expectedState);
      res.status(403).json({ 
        error: "invalid oauth state",
        debug: {
          received: state,
          expected: expectedState,
          cookieHeader: cookies
        }
      });
      return;
    }

    const { clientId, clientSecret } = googleCredentials();
    if (!clientId || !clientSecret) {
      console.error("[Google OAuth] Missing credentials");
      res.status(500).json({ error: "Google sign-in is not configured." });
      return;
    }

    try {
      const { data: tokenData } = await axios.post<{ access_token?: string }>(
        GOOGLE_TOKEN_URL,
        new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: callbackUrl(req),
          grant_type: "authorization_code",
        }).toString(),
        {
          headers: { "content-type": "application/x-www-form-urlencoded" },
          timeout: 30_000,
        }
      );

      if (!tokenData.access_token) {
        throw new Error("access_token missing from Google token response");
      }

      const { data: userInfo } = await axios.post<{
        sub?: string;
        name?: string;
        email?: string;
      }>(
        GOOGLE_USERINFO_URL,
        {},
        {
          headers: { authorization: `Bearer ${tokenData.access_token}` },
          timeout: 30_000,
        }
      );

      if (!userInfo.sub) {
        res.status(400).json({ error: "sub missing from Google user info" });
        return;
      }

      const openId = `google_${userInfo.sub}`;
      const displayName = userInfo.name || userInfo.email || "Google User";

      await db.upsertUser({
        openId: openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(openId, {
        name: displayName,
        expiresInMs: ONE_YEAR_MS,
      });

      console.log("[Google OAuth] Created session token for:", openId, "name:", displayName);
      console.log("[Google OAuth] Cookie options:", getSessionCookieOptions(req));

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      console.log("[Google OAuth] Set cookie and redirecting to /");
      res.redirect(302, "/");
    } catch (err) {
      console.error("[Google OAuth] Callback failed", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[Google OAuth] Error details:", errorMessage);
      res.status(500).json({ 
        error: "Google sign-in failed", 
        details: errorMessage,
        hint: "Check server logs for more details"
      });
    }
  });
}
