/**
 * The viewer's IANA time zone, e.g. `Asia/Kolkata`.
 *
 * Sent with every chat turn so the server can state the time in the *user's*
 * zone. Without it the model would be told the server's clock, which on a hosted
 * deployment is typically UTC and therefore wrong for most of the world.
 *
 * Returns an empty string when the runtime cannot determine a zone, which the
 * server treats as "fall back to the server's own zone".
 */
export function currentTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}
