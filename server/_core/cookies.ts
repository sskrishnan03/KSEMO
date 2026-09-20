import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): CookieOptions {
  const hostname = req.hostname || "";
  const isLocal =
    LOCAL_HOSTS.has(hostname) ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    isIpAddress(hostname);

  const secure = !isLocal || isSecureRequest(req);

  // Never set an explicit Domain attribute.
  //
  // When Domain is omitted the browser scopes the cookie to the exact
  // hostname that set it — which is exactly what a same-origin app needs.
  //
  // Setting Domain to ".ksemo.onrender.com" (or any *.onrender.com /
  // *.run.app subdomain) is actively harmful: those TLDs are on the Public
  // Suffix List (PSL) and browsers silently reject cookies whose Domain
  // attribute falls under a PSL entry, causing the session cookie to never
  // be stored at all.
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure,
    // domain intentionally omitted — browser defaults to exact hostname
  };
}
