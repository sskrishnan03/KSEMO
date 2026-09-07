import { COOKIE_NAME } from "@shared/const";

export function getAuthToken(): string | null {
  try {
    const directToken =
      sessionStorage.getItem("ksemo-token") ||
      localStorage.getItem("ksemo-token");
    if (directToken) return directToken;

    const raw =
      sessionStorage.getItem("ksemo-cookie") ||
      localStorage.getItem("ksemo-cookie");
    if (raw) {
      const prefix = `${COOKIE_NAME}=`;
      const pair = raw.split(";").find(s => s.trim().startsWith(prefix));
      const token =
        pair?.trim().slice(prefix.length) ||
        (raw.startsWith(prefix) ? raw.slice(prefix.length) : raw);
      if (token) return token;
    }
  } catch {
    // Storage unavailable
  }
  return null;
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
