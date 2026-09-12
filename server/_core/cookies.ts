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

  // Avoid setting explicit wildcard domain for Cloud Run (*.run.app) as it is on the Public Suffix List
  const isCloudRun = hostname.endsWith(".run.app");
  const shouldSetDomain = hostname && !isLocal && !isCloudRun;

  const domain =
    shouldSetDomain && !hostname.startsWith(".")
      ? `.${hostname}`
      : shouldSetDomain
        ? hostname
        : undefined;

  const secure = !isLocal || isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    domain,
    // SameSite=None + Secure + partitioned allows cookies to work in cross-origin
    // iframes. Partitioned is only valid on secure (https) connections, so it is
    // enabled purely when `secure` is true to avoid Chrome rejecting the cookie.
    sameSite: secure ? "none" : "lax",
    secure,
    partitioned: secure,
  } as CookieOptions;
}
