import crypto from "crypto";
import { ENV } from "./env";

/** Create an opaque, tamper-proof link that grants access to one file only. */
export function createFileShareToken(fileId: string): string {
  const payload = Buffer.from(JSON.stringify({ fileId })).toString("base64url");
  const signature = crypto
    .createHmac("sha256", ENV.cookieSecret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function readFileShareToken(token: string): string | null {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = crypto
    .createHmac("sha256", ENV.cookieSecret)
    .update(payload)
    .digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected))
    return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof parsed.fileId === "string" && parsed.fileId.length > 0
      ? parsed.fileId
      : null;
  } catch {
    return null;
  }
}
