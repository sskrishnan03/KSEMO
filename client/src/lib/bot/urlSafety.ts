/**
 * URL validation and secure browser opening utilities for KSEMO Bot.
 *
 * Strict security rules:
 * - Reject javascript:, data:, vbscript:, and file: schemes.
 * - Only allow http: and https: protocols.
 * - Always use window.open(url, "_blank", "noopener,noreferrer") to protect user security
 *   and keep the KSEMO tab open.
 * - Handle browser popup blockers gracefully and return precise success/blocked states.
 */

const BLOCKED_SCHEMES = ["javascript:", "data:", "vbscript:", "file:", "about:"];

export interface OpenResult {
  success: boolean;
  blocked?: boolean;
  url?: string;
  error?: string;
}

/**
 * Validates whether a URL is safe to open externally.
 */
export function isValidExternalUrl(urlStr: string): boolean {
  if (!urlStr || typeof urlStr !== "string") return false;
  const trimmed = urlStr.trim().toLowerCase();

  // Reject dangerous schemes immediately
  for (const scheme of BLOCKED_SCHEMES) {
    if (trimmed.startsWith(scheme)) return false;
  }

  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Normalizes a raw string or domain into a safe https URL.
 */
export function normalizeSafeUrl(raw: string): string | null {
  if (!raw) return null;
  let target = raw.trim();

  // If already full URL
  if (/^https?:\/\//i.test(target)) {
    return isValidExternalUrl(target) ? target : null;
  }

  // Prepend https://
  target = `https://${target}`;
  return isValidExternalUrl(target) ? target : null;
}

/**
 * Opens an external URL in a NEW browser tab safely.
 *
 * Returns:
 * - { success: true, url } if opened
 * - { success: false, blocked: true, url } if blocked by popup blocker
 * - { success: false, error } if invalid URL
 */
export function openExternalUrl(rawUrl: string): OpenResult {
  const url = normalizeSafeUrl(rawUrl);
  if (!url) {
    return {
      success: false,
      error: "Invalid or unsafe destination URL.",
    };
  }

  if (typeof window === "undefined") {
    return { success: false, error: "Window is unavailable." };
  }

  try {
    // Open in a new tab with noopener,noreferrer
    const newWindow = window.open(url, "_blank", "noopener,noreferrer");

    // Modern browsers return null, undefined, or an immediately closed window when popup blocked
    if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
      return {
        success: false,
        blocked: true,
        url,
        error: "Popup was blocked by the browser.",
      };
    }

    return {
      success: true,
      url,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to open new tab.",
    };
  }
}
