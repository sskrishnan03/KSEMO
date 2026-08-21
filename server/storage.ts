// Local file storage for KSEMO
// Uploads are written to .ksemo-uploads/ at the project root and served
// via /ksemo-storage/{key} by the local storage proxy.

import fs from "fs";
import path from "path";
import crypto from "crypto";

const UPLOADS_DIR = path.join(process.cwd(), ".ksemo-uploads");

function sanitizeKey(relKey: string): string {
  const key = relKey.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!key || key.split("/").some(part => part === ".." || part === "")) {
    throw new Error(`Invalid storage key: ${relKey}`);
  }
  return key;
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export function resolveStoragePath(relKey: string): string {
  const key = sanitizeKey(relKey);
  const absolute = path.resolve(UPLOADS_DIR, key);
  if (!absolute.startsWith(path.resolve(UPLOADS_DIR) + path.sep)) {
    throw new Error(`Invalid storage key: ${relKey}`);
  }
  return absolute;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  _contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(sanitizeKey(relKey));
  const absolute = path.resolve(UPLOADS_DIR, key);
  if (!absolute.startsWith(path.resolve(UPLOADS_DIR) + path.sep)) {
    throw new Error(`Invalid storage key: ${relKey}`);
  }

  await fs.promises.mkdir(path.dirname(absolute), { recursive: true });
  await fs.promises.writeFile(absolute, data);

  return { key, url: `/ksemo-storage/${key}` };
}

export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  const key = sanitizeKey(relKey);
  return { key, url: `/ksemo-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const { url } = await storageGet(relKey);
  return url;
}
