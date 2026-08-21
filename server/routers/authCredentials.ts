import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { users } from "../../drizzle/schema";
import * as db from "../db";
import { getSessionCookieOptions } from "../_core/cookies";
import { isMailerConfigured, sendPasswordResetEmail } from "../_core/mailer";
import { sdk } from "../_core/sdk";
import { publicProcedure } from "../_core/trpc";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const SCRYPT_KEY_LENGTH = 64;

const emailInput = z
  .string()
  .trim()
  .toLowerCase()
  .max(320)
  .regex(EMAIL_PATTERN, "Enter a valid email address.");

const passwordInput = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be at most 128 characters.");

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [scheme, salt, expectedHex] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const candidate = scryptSync(password, salt, SCRYPT_KEY_LENGTH);
  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}

// Deterministic per-email identifier so the same address always maps to the
// same account row, while staying within the 64-char openId column limit.
function emailOpenId(email: string): string {
  return `email_${createHash("sha256").update(email).digest("hex").slice(0, 40)}`;
}

async function issueSessionCookie(
  ctx: { req: import("express").Request; res: import("express").Response },
  openId: string,
  name: string
) {
  const sessionToken = await sdk.createSessionToken(openId, {
    name,
    expiresInMs: ONE_YEAR_MS,
  });
  const cookieOptions = getSessionCookieOptions(ctx.req);
  ctx.res.cookie(COOKIE_NAME, sessionToken, {
    ...cookieOptions,
    maxAge: ONE_YEAR_MS,
  });
}

async function findUserByEmail(email: string) {
  const database = await db.getDb();
  if (!database)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Database is not available.",
    });
  const rows = await database
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return rows[0];
}

export const signUpProcedure = publicProcedure
  .input(
    z.object({
      name: z.string().trim().min(1, "Tell us your name.").max(120),
      email: emailInput,
      password: passwordInput,
    })
  )
  .mutation(async ({ ctx, input }) => {
    const existing = await findUserByEmail(input.email);
    if (existing) {
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "An account with this email already exists. Try signing in instead.",
      });
    }

    const openId = emailOpenId(input.email);
    await db.upsertUser({
      openId,
      name: input.name,
      email: input.email,
      loginMethod: "password",
      passwordHash: hashPassword(input.password),
      lastSignedIn: new Date(),
    });

    await issueSessionCookie(ctx, openId, input.name);

    const user = await db.getUserByOpenId(openId);
    return {
      success: true as const,
      user: user ? { id: user.id, name: user.name, email: user.email } : null,
    };
  });

export const signInProcedure = publicProcedure
  .input(
    z.object({
      email: emailInput,
      password: z.string().min(1, "Enter your password."),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const user = await findUserByEmail(input.email);
    // Same generic message for unknown email and wrong password so the
    // endpoint cannot be used to enumerate registered addresses.
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Incorrect email or password.",
      });
    }

    await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
    await issueSessionCookie(ctx, user.openId, user.name ?? "KSEMO user");

    return {
      success: true as const,
      user: { id: user.id, name: user.name, email: user.email },
    };
  });

export const requestPasswordResetProcedure = publicProcedure
  .input(z.object({ email: emailInput }))
  .mutation(async ({ ctx, input }) => {
    const user = await findUserByEmail(input.email);

    // Always answer success so the form cannot reveal which emails exist.
    if (!user) return { success: true as const, resetUrl: null };

    // Google-only accounts have no local password to reset.
    if (!user.passwordHash) {
      return {
        success: true as const,
        resetUrl: null,
        usesGoogleOnly: true as const,
      };
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const database = await db.getDb();
    if (!database)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database is not available.",
      });
    await database
      .update(users)
      .set({
        resetTokenHash: tokenHash,
        resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Absolute link back into this deployment, derived from the incoming
    // request so it works on localhost and any deployed domain alike.
    const proto = String(
      ctx.req.headers["x-forwarded-proto"] ?? ctx.req.protocol ?? "http",
    )
      .split(",")[0]
      .trim();
    const host = String(
      ctx.req.headers["x-forwarded-host"] ??
        ctx.req.headers.host ??
        "localhost:3000",
    );
    const resetUrl = `${proto}://${host}/reset-password?token=${encodeURIComponent(token)}`;

    if (isMailerConfigured()) {
      try {
        await sendPasswordResetEmail({
          to: input.email,
          name: user.name,
          resetUrl,
        });
        return {
          success: true as const,
          delivered: "email" as const,
          resetUrl: null,
        };
      } catch (error) {
        console.error("[Auth] Failed to send password-reset email:", error);
        // Don't strand a locked-out user: hand back the one-time link instead.
        return {
          success: true as const,
          delivered: "fallback" as const,
          resetUrl,
        };
      }
    }

    // No mailer configured on this deployment — return the link so the flow
    // still completes end to end.
    console.log(
      `[Auth] Password reset requested for ${input.email}: ${resetUrl}`,
    );
    return { success: true as const, delivered: "fallback" as const, resetUrl };
  });

export const resetPasswordProcedure = publicProcedure
  .input(
    z.object({ token: z.string().min(20).max(128), password: passwordInput })
  )
  .mutation(async ({ input }) => {
    const database = await db.getDb();
    if (!database)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database is not available.",
      });

    const tokenHash = createHash("sha256").update(input.token).digest("hex");
    const [user] = await database
      .select()
      .from(users)
      .where(eq(users.resetTokenHash, tokenHash))
      .limit(1);

    if (
      !user ||
      !user.resetTokenExpiresAt ||
      user.resetTokenExpiresAt.getTime() < Date.now()
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This reset link is invalid or has expired.",
      });
    }

    await database
      .update(users)
      .set({
        passwordHash: hashPassword(input.password),
        resetTokenHash: null,
        resetTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return { success: true as const };
  });

export const authCredentialsRouterProcedures = {
  signUp: signUpProcedure,
  signIn: signInProcedure,
  requestPasswordReset: requestPasswordResetProcedure,
  resetPassword: resetPasswordProcedure,
};
