import {
  AXIOS_TIMEOUT_MS,
  COOKIE_NAME,
  ONE_YEAR_MS,
  decodeOAuthState,
} from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import axios, { type AxiosInstance } from "axios";
import { randomUUID } from "crypto";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../supabase-db";
import * as db from "../supabase-db";
import { DatabaseUnavailableError } from "../supabase-db";
import { ENV } from "./env";
import type {
  ExchangeTokenRequest,
  ExchangeTokenResponse,
  GetUserInfoResponse,
  GetUserInfoWithJwtRequest,
  GetUserInfoWithJwtResponse,
} from "./types/authTypes";
// Utility function
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
  /**
   * Unique session identifier. Attached at signing time so a session can be
   * revoked server-side on logout. Without this a stateless JWT stays valid
   * for its whole lifetime no matter how often the user signs out, and any
   * request that still carries the old token (a retried query, a background
   * refetch that captured the token before logout, a second tab, the
   * localStorage fallback) re-authenticates the user a second later.
   */
  jti?: string;
};

/**
 * Server-side revocation of signed sessions.
 *
 * KSEMO sessions are stateless JWTs signed with the shared secret. A JWT is
 * only invalidated by its `exp`, so "sign out" used to merely clear the
 * cookie/hash — the same token kept authenticating requests that still carried
 * it (bearer header fallback, retries, races), which made logouts bounce back
 * to signed-in within a second on deployed environments.
 *
 * Each session is now minted with a unique `jti`. When a session is revoked
 * (logout, account deletion) its `jti` is recorded here and `verifySession`
 * rejects it on all future requests — regardless of whether the client still
 * sends it via cookie, header, or both.
 *
 * The denylist is held in memory. On the Render free plan the app runs as a
 * single instance, so this is globally authoritative. Multi-instance or
 * restart clears the list, which degrades gracefully (revoked tokens expire
 * naturally within a year and clients drop them on logout anyway). Keyed by
 * `jti` so revoking one browser never signs out the user's other devices.
 */
const MAX_REVOKED_SESSIONS = 50_000;
const revokedSessionIds = new Map<string, number>(); // jti -> unix expiry (seconds)

let lastRevokedPrune = 0;

function pruneRevokedSessions() {
  const now = Math.floor(Date.now() / 1000);
  if (now - lastRevokedPrune < 5 * 60) return;
  lastRevokedPrune = now;
  for (const [jti, exp] of revokedSessionIds) {
    if (exp <= now) revokedSessionIds.delete(jti);
  }
}

function isSessionRevoked(jti: string | undefined): boolean {
  if (!isNonEmptyString(jti)) return false;
  pruneRevokedSessions();
  return revokedSessionIds.has(jti);
}

/**
 * The request carried a cryptographically-valid session JWT, but the account
 * behind it could not be resolved (OAuth server unreachable, DB unavailable,
 * unexpected lookup failure). This is an infrastructure problem, NOT a logged-
 * out user: callers must preserve the session cookie instead of clearing it.
 */
export class SessionLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionLookupError";
  }
}

const EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
const GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
const GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;

class OAuthService {
  constructor(private client: ReturnType<typeof axios.create>) {
    // OAuth service initialized
  }

  private decodeState(state: string): string {
    return decodeOAuthState(state).redirectUri;
  }

  async getTokenByCode(
    code: string,
    state: string
  ): Promise<ExchangeTokenResponse> {
    const payload: ExchangeTokenRequest = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state),
    };

    const { data } = await this.client.post<ExchangeTokenResponse>(
      EXCHANGE_TOKEN_PATH,
      payload
    );

    return data;
  }

  async getUserInfoByToken(
    token: ExchangeTokenResponse
  ): Promise<GetUserInfoResponse> {
    const { data } = await this.client.post<GetUserInfoResponse>(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken,
      }
    );

    return data;
  }
}

const createOAuthHttpClient = (): AxiosInstance =>
  axios.create({
    baseURL: ENV.oAuthServerUrl,
    timeout: AXIOS_TIMEOUT_MS,
  });

class SDKServer {
  private readonly client: AxiosInstance;
  private readonly oauthService: OAuthService;

  constructor(client: AxiosInstance = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }

  private deriveLoginMethod(
    platforms: unknown,
    fallback: string | null | undefined
  ): string | null {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set<string>(
      platforms.filter((p): p is string => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (
      set.has("REGISTERED_PLATFORM_MICROSOFT") ||
      set.has("REGISTERED_PLATFORM_AZURE")
    )
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }

  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(
    code: string,
    state: string
  ): Promise<ExchangeTokenResponse> {
    return this.oauthService.getTokenByCode(code, state);
  }

  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken: string): Promise<GetUserInfoResponse> {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken,
    } as ExchangeTokenResponse);
    const loginMethod = this.deriveLoginMethod(
      (data as any)?.platforms,
      (data as any)?.platform ?? data.platform ?? null
    );
    return {
      ...(data as any),
      platform: loginMethod,
      loginMethod,
    } as GetUserInfoResponse;
  }

  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }

    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }

  /**
   * Create a session token for a user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || "",
      },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
      jti: payload.jti || randomUUID(),
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<{ openId: string; appId: string; name: string } | null> {
    if (!cookieValue) {
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();

      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });

      // A session that was explicitly revoked (sign out, account deletion)
      // is invalid on every channel: cookie, Authorization header, or both.
      // Without this check a logged-out token kept working for up to a year.
      if (isSessionRevoked(payload.jti)) {
        return null;
      }

      const { openId, appId, name } = payload as Record<string, unknown>;

      if (
        !isNonEmptyString(openId) ||
        !isNonEmptyString(appId) ||
        !isNonEmptyString(name)
      ) {
        return null;
      }

      return {
        openId,
        appId,
        name,
      };
    } catch {
      return null;
    }
  }

  /**
   * Pull the session token this request is presenting — from the
   * Authorization header (used by the client as a localStorage fallback) or,
   * failing that, the `app_session_id` cookie. Used by logout/account-deletion
   * so the exact session being ended can be revoked.
   */
  extractSessionToken(req: Request): string | undefined {
    const authHeader = req.headers.authorization;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      if (token) return token;
    }

    const cookies = this.parseCookies(req.headers.cookie);
    const cookieToken = cookies.get(COOKIE_NAME);
    return cookieToken || undefined;
  }

  /**
   * Permanently invalidate a session token on the server. After this returns
   * true, `verifySession` rejects the token on every future request, so the
   * user cannot be re-authenticated by a stale cookie or a stale
   * Authorization header.
   */
  async revokeSession(token: string | undefined | null): Promise<boolean> {
    if (!token) return false;
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(token, secretKey, {
        algorithms: ["HS256"],
      });
      const jti = payload.jti;
      if (!isNonEmptyString(jti)) return false;

      const exp = typeof payload.exp === "number" ? payload.exp : Infinity;
      revokedSessionIds.set(jti, exp === Infinity ? Math.floor(Date.now() / 1000) + 60 * 60 : exp);

      if (revokedSessionIds.size > MAX_REVOKED_SESSIONS) {
        pruneRevokedSessions();
      }
      return true;
    } catch {
      return false;
    }
  }

  async getUserInfoWithJwt(
    jwtToken: string
  ): Promise<GetUserInfoWithJwtResponse> {
    const payload: GetUserInfoWithJwtRequest = {
      jwtToken,
      projectId: ENV.appId,
    };

    const { data } = await this.client.post<GetUserInfoWithJwtResponse>(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );

    const loginMethod = this.deriveLoginMethod(
      (data as any)?.platforms,
      (data as any)?.platform ?? data.platform ?? null
    );
    return {
      ...(data as any),
      platform: loginMethod,
      loginMethod,
    } as GetUserInfoWithJwtResponse;
  }

  async authenticateRequest(req: Request): Promise<AuthenticatedUser | null> {
    let sessionToken: string | undefined;

    // 1. Check Authorization header (used for iframe / preview / Safari token fallback)
    const authHeader = req.headers.authorization;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      if (token) {
        sessionToken = token;
      }
    }

    let session = sessionToken ? await this.verifySession(sessionToken) : null;

    // 2. If Authorization header was not present or didn't verify, check session cookie
    if (!session) {
      const cookies = this.parseCookies(req.headers.cookie);
      const cookieToken = cookies.get(COOKIE_NAME);
      if (cookieToken && cookieToken !== sessionToken) {
        const cookieSession = await this.verifySession(cookieToken);
        if (cookieSession) {
          session = cookieSession;
          sessionToken = cookieToken;
        }
      }
    }

    // No usable token, or the token failed signature/expiry verification:
    // this is a definitively invalid session and the caller may clear it.
    if (!session || !sessionToken) {
      return null;
    }

    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      let userInfo;
      try {
        userInfo = await this.getUserInfoWithJwt(sessionToken);
      } catch {
        // Valid JWT but the OAuth server is not reachable right now. Preserve
        // the session; this is an infrastructure problem, not a logout.
        throw new SessionLookupError("OAuth user-info lookup failed for cron session");
      }
      const taskUid = userInfo.taskUid ?? null;
      if (taskUid) {
        return buildCronUser(userInfo);
      }
      return null;
    }

    const sessionUserId = session.openId;
    const signedInAt = new Date();

    let user: User | null = null;
    try {
      user = (await db.getUserByOpenId(sessionUserId)) ?? null;
    } catch (e) {
      if (e instanceof DatabaseUnavailableError) throw e;
      throw new SessionLookupError("user lookup failed");
    }

    // A signed session whose account no longer exists (e.g. the account was
    // deleted) must NOT be turned into a phantom user. First try to
    // re-sync from the OAuth server; only if that genuinely resolves an
    // account do we recreate it.
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await db.upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt,
        });
        user = (await db.getUserByOpenId(userInfo.openId)) ?? null;
      } catch (e) {
        if (e instanceof DatabaseUnavailableError) throw e;
        if (e instanceof SessionLookupError) throw e;
        // The JWT is valid but neither the DB nor the OAuth server could
        // resolve the account. Don't log the user out over an outage: surface
        // an infrastructure error so the client keeps the session.
        throw new SessionLookupError("account sync failed while resolving session");
      }
    }

    if (!user) {
      // After a successful sync attempt the account still does not exist. The
      // JWT was signed for an account that no longer exists — treat as logged
      // out so the client returns to the sign-in screen.
      return null;
    }

    try {
      await db.upsertUser({
        openId: user.openId,
        lastSignedIn: signedInAt,
      });
    } catch (e) {
      if (e instanceof DatabaseUnavailableError) throw e;
      throw new SessionLookupError("session touch failed");
    }

    return user;
  }
}

const CRON_OPEN_ID_PREFIX = "cron_";

/** Result of `sdk.authenticateRequest`. Cron callbacks set `isCron=true` and `taskUid`; see `/home/ubuntu/skills/webdev-periodic-updates/SKILL.md`. */
export type AuthenticatedUser = User & {
  taskUid?: string;
  isCron?: boolean;
};

function buildCronUser(
  userInfo: GetUserInfoWithJwtResponse
): AuthenticatedUser {
  const now = new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? undefined,
    isCron: true,
  } as any;
}

export const sdk = new SDKServer();
