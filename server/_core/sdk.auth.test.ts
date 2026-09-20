import { describe, expect, it } from "vitest";
import { sdk } from "./sdk";

/**
 * Regression tests for server-side session revocation.
 *
 * KSEMO sessions are stateless JWTs that live for a year in BOTH the HttpOnly
 * cookie and the client's localStorage (sent as `Authorization: Bearer`).
 * Because a JWT cannot be un-issued, "sign out" used to only clear the cookie
 * and storage; any request still carrying the token (a retry, a race, a second
 * tab) re-authenticated the user a second later. These tests pin the fix: each
 * session carries a `jti` that `revokeSession()` denylists so `verifySession()`
 * rejects the token on every channel afterwards.
 */
describe("sdk session revocation", () => {
  it("rejects a session token after revokeSession", async () => {
    const token = await sdk.signSession({
      openId: "audit-user",
      appId: "ksemo-test",
      name: "Audit User",
      jti: "audit-revoke-1",
    });

    expect(await sdk.verifySession(token)).toMatchObject({
      openId: "audit-user",
      appId: "ksemo-test",
    });

    expect(await sdk.revokeSession(token)).toBe(true);
    expect(await sdk.verifySession(token)).toBeNull();
  });

  it("mints a unique jti when none is supplied and can revoke by it", async () => {
    const tokenA = await sdk.signSession({
      openId: "audit-user",
      appId: "ksemo-test",
      name: "Audit User",
    });
    const tokenB = await sdk.signSession({
      openId: "audit-user",
      appId: "ksemo-test",
      name: "Audit User",
    });

    expect(tokenA).not.toBe(tokenB);
    await sdk.revokeSession(tokenA);
    expect(await sdk.verifySession(tokenA)).toBeNull();
    expect(await sdk.verifySession(tokenB)).not.toBeNull();
  });

  it("leaves other sessions of the same user untouched", async () => {
    const desktop = await sdk.signSession({
      openId: "audit-user",
      appId: "ksemo-test",
      name: "Audit User",
      jti: "audit-desktop",
    });
    const phone = await sdk.signSession({
      openId: "audit-user",
      appId: "ksemo-test",
      name: "Audit User",
      jti: "audit-phone",
    });

    await sdk.revokeSession(desktop);
    expect(await sdk.verifySession(desktop)).toBeNull();
    expect(await sdk.verifySession(phone)).not.toBeNull();
  });

  it("does not accidentally revoke unrelated tokens", async () => {
    expect(await sdk.revokeSession("not-a-jwt")).toBe(false);
    expect(await sdk.revokeSession(null)).toBe(false);
    expect(await sdk.revokeSession(undefined)).toBe(false);
  });
});