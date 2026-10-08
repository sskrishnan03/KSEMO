import crypto from "crypto";
import express from "express";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { protectedProcedure, router } from "./_core/trpc";
import { createFileForUser } from "./supabase-db";
import { supabase, isSupabaseConfigured } from "./supabase-db";
import { storagePut } from "./storage";
import { extractFileText } from "./fileExtract";

type Provider = "google" | "microsoft";
type TokenSet = {
  userId: number;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  email?: string;
};
const volatileTokens = new Map<string, TokenSet>();
const MAX_BYTES = 25 * 1024 * 1024;
async function readBoundedBody(response: Response): Promise<Buffer> {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new TRPCError({
        code: "PAYLOAD_TOO_LARGE",
        message: "Files must be 25 MB or smaller.",
      });
    }
    chunks.push(value);
  }
  return Buffer.concat(
    chunks.map(chunk => Buffer.from(chunk)),
    total
  );
}
const googleId =
  process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "";
const googleSecret =
  process.env.GOOGLE_CLIENT_SECRET ||
  process.env.VITE_GOOGLE_CLIENT_SECRET ||
  "";
const microsoftId = process.env.MICROSOFT_CLIENT_ID || "";
const microsoftSecret = process.env.MICROSOFT_CLIENT_SECRET || "";
const configured = (p: Provider) =>
  p === "google"
    ? Boolean(googleId && googleSecret)
    : Boolean(microsoftId && microsoftSecret);
const callbackPath = (p: Provider) => `/api/cloud/${p}/callback`;

function seal(value: string) {
  const key = crypto.createHash("sha256").update(ENV.cookieSecret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}
function unseal(ciphertext: string, iv: string, tag: string) {
  const key = crypto.createHash("sha256").update(ENV.cookieSecret).digest();
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
async function putToken(provider: Provider, token: TokenSet) {
  if (!isSupabaseConfigured) {
    volatileTokens.set(`${token.userId}:${provider}`, token);
    return;
  }
  const access = seal(token.accessToken);
  const refresh = token.refreshToken ? seal(token.refreshToken) : null;
  const { error } = await supabase.from("user_integrations").upsert(
    {
      user_id: token.userId,
      provider,
      token_ciphertext: access.ciphertext,
      token_iv: access.iv,
      token_tag: access.tag,
      refresh_ciphertext: refresh?.ciphertext ?? null,
      refresh_iv: refresh?.iv ?? null,
      refresh_tag: refresh?.tag ?? null,
      expires_at: new Date(token.expiresAt).toISOString(),
      account_email: token.email ?? null,
    },
    { onConflict: "user_id,provider" }
  );
  if (error) throw new Error(`Could not save ${provider} authorization`);
}
async function getToken(
  userId: number,
  provider: Provider
): Promise<TokenSet | undefined> {
  if (!isSupabaseConfigured) return volatileTokens.get(`${userId}:${provider}`);
  const { data, error } = await supabase
    .from("user_integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw new Error("Could not load connected cloud accounts");
  if (!data) return;
  return {
    userId,
    accessToken: unseal(data.token_ciphertext, data.token_iv, data.token_tag),
    refreshToken: data.refresh_ciphertext
      ? unseal(data.refresh_ciphertext, data.refresh_iv, data.refresh_tag)
      : undefined,
    expiresAt: new Date(data.expires_at).getTime(),
    email: data.account_email ?? undefined,
  };
}
async function removeToken(userId: number, provider: Provider) {
  volatileTokens.delete(`${userId}:${provider}`);
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from("user_integrations")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);
  if (error) throw new Error("Could not disconnect cloud account");
}
function signedState(userId: number) {
  const body = Buffer.from(
    JSON.stringify({
      userId,
      nonce: crypto.randomBytes(18).toString("hex"),
      exp: Date.now() + 10 * 60_000,
    })
  ).toString("base64url");
  return `${body}.${crypto.createHmac("sha256", ENV.cookieSecret).update(body).digest("base64url")}`;
}
function verifyState(state: string) {
  const [body, signature] = state.split(".");
  if (!body || !signature) return null;
  const expected = crypto
    .createHmac("sha256", ENV.cookieSecret)
    .update(body)
    .digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (
    actual.length !== expected.length ||
    !crypto.timingSafeEqual(actual, expected)
  )
    return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    return payload.exp > Date.now() ? (payload as { userId: number }) : null;
  } catch {
    return null;
  }
}
async function authenticatedToken(userId: number, provider: Provider) {
  let token = await getToken(userId, provider);
  if (!token)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Connect this cloud account first.",
    });
  if (token.expiresAt > Date.now() + 60_000) return token;
  if (!token.refreshToken) {
    await removeToken(userId, provider);
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Cloud authorization expired. Reconnect the account.",
    });
  }
  const endpoint =
    provider === "google"
      ? "https://oauth2.googleapis.com/token"
      : "https://login.microsoftonline.com/common/oauth2/v2.0/token";
  const body = new URLSearchParams({
    client_id: provider === "google" ? googleId : microsoftId,
    client_secret: provider === "google" ? googleSecret : microsoftSecret,
    refresh_token: token.refreshToken,
    grant_type: "refresh_token",
  });
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await response.json()) as any;
  if (!response.ok || !data.access_token) {
    await removeToken(userId, provider);
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Cloud authorization expired. Reconnect the account.",
    });
  }
  token = {
    ...token,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || token.refreshToken,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
  };
  await putToken(provider, token);
  return token;
}

export const cloudRouter = router({
  status: protectedProcedure.query(async ({ ctx }) =>
    Promise.all(
      (["google", "microsoft"] as Provider[]).map(async provider => ({
        provider,
        configured: configured(provider),
        connected: Boolean(await getToken(ctx.user.id, provider)),
        email: (await getToken(ctx.user.id, provider))?.email ?? null,
      }))
    )
  ),
  connectUrl: protectedProcedure
    .input(z.object({ provider: z.enum(["google", "microsoft"]) }))
    .mutation(({ ctx, input }) => {
      const p = input.provider;
      if (!configured(p))
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `${p === "google" ? "Google Drive" : "OneDrive"} is not configured on this server.`,
        });
      const origin = `${ctx.req.protocol}://${ctx.req.get("host")}`;
      const redirectUri = `${origin}${callbackPath(p)}`;
      const state = signedState(ctx.user.id);
      const url =
        p === "google"
          ? new URL("https://accounts.google.com/o/oauth2/v2/auth")
          : new URL(
              "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
            );
      url.search = new URLSearchParams({
        client_id: p === "google" ? googleId : microsoftId,
        redirect_uri: redirectUri,
        response_type: "code",
        response_mode: "query",
        scope:
          p === "google"
            ? "openid email https://www.googleapis.com/auth/drive.readonly"
            : "openid email offline_access Files.Read User.Read",
        state,
        access_type: "offline",
        prompt: "consent",
      }).toString();
      return { url: url.toString() };
    }),
  files: protectedProcedure
    .input(
      z.object({
        provider: z.enum(["google", "microsoft"]),
        query: z.string().max(200).default(""),
      })
    )
    .query(async ({ ctx, input }) => {
      const token = await authenticatedToken(ctx.user.id, input.provider);
      if (input.provider === "google") {
        const q = input.query.trim();
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files?${new URLSearchParams({ q: `trashed=false${q ? ` and name contains '${q.replace(/'/g, "\\'")}'` : ""}`, pageSize: "50", orderBy: "modifiedTime desc", fields: "files(id,name,mimeType,size,modifiedTime,webViewLink)" })}`,
          { headers: { authorization: `Bearer ${token.accessToken}` } }
        );
        const data = (await response.json()) as any;
        if (!response.ok)
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: "Google Drive search failed.",
          });
        return (data.files ?? [])
          .filter(
            (f: any) => f.mimeType !== "application/vnd.google-apps.folder"
          )
          .map((f: any) => ({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            size: Number(f.size || 0),
            modifiedAt: f.modifiedTime,
            webUrl: f.webViewLink,
          }));
      }
      const path = input.query.trim()
        ? `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${encodeURIComponent(input.query.trim()).replace(/'/g, "''")}')`
        : "https://graph.microsoft.com/v1.0/me/drive/root/children";
      const response = await fetch(
        `${path}?$top=50&$select=id,name,size,file,lastModifiedDateTime,webUrl`,
        { headers: { authorization: `Bearer ${token.accessToken}` } }
      );
      const data = (await response.json()) as any;
      if (!response.ok)
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: "OneDrive search failed.",
        });
      return (data.value ?? [])
        .filter((f: any) => f.file)
        .map((f: any) => ({
          id: f.id,
          name: f.name,
          mimeType: f.file?.mimeType,
          size: Number(f.size || 0),
          modifiedAt: f.lastModifiedDateTime,
          webUrl: f.webUrl,
        }));
    }),
  importFile: protectedProcedure
    .input(
      z.object({
        provider: z.enum(["google", "microsoft"]),
        id: z.string().min(1),
        name: z.string().min(1).max(500),
        mimeType: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const token = await authenticatedToken(ctx.user.id, input.provider);
      const googleTypes: Record<
        string,
        { extension: string; mimeType: string }
      > = {
        "application/vnd.google-apps.document": {
          extension: "docx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
        "application/vnd.google-apps.spreadsheet": {
          extension: "xlsx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        "application/vnd.google-apps.presentation": {
          extension: "pptx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        },
      };
      const nativeGoogleType =
        input.provider === "google"
          ? googleTypes[input.mimeType || ""]
          : undefined;
      const filename = nativeGoogleType
        ? `${input.name.replace(/\.[^.]+$/, "")}.${nativeGoogleType.extension}`
        : input.name;
      const ext = filename.split(".").pop()?.toLowerCase() || "";
      const allowed = new Set([
        "pdf",
        "doc",
        "docx",
        "xls",
        "xlsx",
        "ppt",
        "pptx",
        "txt",
        "md",
        "csv",
        "rtf",
        "odt",
        "ods",
        "odp",
        "json",
        "html",
      ]);
      if (!allowed.has(ext))
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This file type is not supported in the Library.",
        });
      let url: string;
      if (input.provider === "google") {
        url = nativeGoogleType
          ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(input.id)}/export?mimeType=${encodeURIComponent(nativeGoogleType.mimeType)}`
          : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(input.id)}?alt=media`;
      } else
        url = `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(input.id)}/content`;
      const response = await fetch(url, {
        headers: { authorization: `Bearer ${token.accessToken}` },
        redirect: "follow",
      });
      if (!response.ok)
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: "Could not download the selected cloud file.",
        });
      const declared = Number(response.headers.get("content-length") || 0);
      if (declared > MAX_BYTES)
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "Files must be 25 MB or smaller.",
        });
      const bytes = await readBoundedBody(response);
      const mimeType =
        nativeGoogleType?.mimeType ||
        response.headers.get("content-type")?.split(";")[0] ||
        input.mimeType ||
        "application/octet-stream";
      const safeFilename = filename.replace(/[\\/]/g, "_");
      const stored = await storagePut(
        `${ctx.user.id}/${crypto.randomUUID()}-${safeFilename}`,
        bytes,
        mimeType
      );
      const contentText = await extractFileText(safeFilename, mimeType, bytes);
      const file = await createFileForUser({
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        projectId: null,
        storageKey: stored.key,
        url: stored.url,
        filename: safeFilename,
        mimeType,
        sizeBytes: bytes.length,
        contentText,
        status: "ready",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return { id: file.id, filename: file.filename };
    }),
  disconnect: protectedProcedure
    .input(z.object({ provider: z.enum(["google", "microsoft"]) }))
    .mutation(async ({ ctx, input }) => {
      await removeToken(ctx.user.id, input.provider);
      return { success: true };
    }),
});

export function registerCloudOAuthRoutes(app: express.Express) {
  for (const provider of ["google", "microsoft"] as const)
    app.get(callbackPath(provider), async (req, res) => {
      const state = verifyState(String(req.query.state || ""));
      if (!state || typeof req.query.code !== "string") {
        res
          .status(400)
          .send("Cloud authorization failed. Return to KSEMO and try again.");
        return;
      }
      const currentUser = await sdk.authenticateRequest(req).catch(() => null);
      if (!currentUser || currentUser.id !== state.userId) {
        res
          .status(403)
          .send(
            "The signed-in KSEMO account changed during cloud authorization. Return to KSEMO and try again."
          );
        return;
      }
      try {
        const redirectUri = `${req.protocol}://${req.get("host")}${callbackPath(provider)}`;
        const endpoint =
          provider === "google"
            ? "https://oauth2.googleapis.com/token"
            : "https://login.microsoftonline.com/common/oauth2/v2.0/token";
        const body = new URLSearchParams({
          client_id: provider === "google" ? googleId : microsoftId,
          client_secret: provider === "google" ? googleSecret : microsoftSecret,
          code: req.query.code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        });
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body,
        });
        const data = (await response.json()) as any;
        if (!response.ok || !data.access_token)
          throw new Error("Token exchange failed");
        let email: string | undefined;
        const profile =
          provider === "google"
            ? "https://openidconnect.googleapis.com/v1/userinfo"
            : "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName";
        const profileRes = await fetch(profile, {
          headers: { authorization: `Bearer ${data.access_token}` },
        });
        if (profileRes.ok) {
          const p = (await profileRes.json()) as any;
          email = p.email || p.mail || p.userPrincipalName;
        }
        await putToken(provider, {
          userId: state.userId,
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
          email,
        });
        res.redirect(
          `${req.protocol}://${req.get("host")}/?workspace=library&drive=${provider}-connected`
        );
      } catch (error) {
        console.error("Cloud OAuth callback failed", error);
        res
          .status(502)
          .send(
            "Could not connect this cloud account. Return to KSEMO and try again."
          );
      }
    });
}
