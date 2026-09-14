// Dual-backend file storage for KSEMO.
// In production (Supabase configured), files are stored in Supabase Storage
// for persistence across restarts/deploys. In dev/test they fall back to the
// local .ksemo-uploads/ directory.

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { supabase, isSupabaseConfigured } from "./supabase-db";

const UPLOADS_DIR = path.join(process.cwd(), ".ksemo-uploads");
const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || "ksemo-files";

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
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(sanitizeKey(relKey));

  if (isSupabaseConfigured) {
    const input =
      data instanceof Buffer
        ? new Uint8Array(data)
        : data instanceof Uint8Array
          ? data
          : new TextEncoder().encode(data);
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(key, input, { contentType, upsert: false });
    if (error) {
      console.error(`[storage] Supabase upload failed for ${key}:`, error);
      throw new Error(`Supabase Storage upload failed: ${error.message}`);
    }
    return { key, url: `/ksemo-storage/${key}` };
  }

  const absolute = path.resolve(UPLOADS_DIR, key);
  if (!absolute.startsWith(path.resolve(UPLOADS_DIR) + path.sep)) {
    throw new Error(`Invalid storage key: ${relKey}`);
  }
  await fs.promises.mkdir(path.dirname(absolute), { recursive: true });
  await fs.promises.writeFile(
    absolute,
    typeof data === "string" ? Buffer.from(data) : data
  );
  return { key, url: `/ksemo-storage/${key}` };
}

export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  const key = sanitizeKey(relKey);
  return { key, url: `/ksemo-storage/${key}` };
}

export async function storageDownload(
  key: string
): Promise<{ data: Buffer | null; contentType: string }> {
  if (isSupabaseConfigured) {
    const { data: blob, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(key);
    if (error || !blob) {
      console.error(`[storage] Supabase download failed for ${key}:`, error);
      return { data: null, contentType: "application/octet-stream" };
    }
    const buffer = Buffer.from(await blob.arrayBuffer());
    return { data: buffer, contentType: blob.type || "application/octet-stream" };
  }

  try {
    const absolute = resolveStoragePath(key);
    const stat = await fs.promises.stat(absolute);
    if (!stat.isFile()) return { data: null, contentType: "application/octet-stream" };
    const buffer = await fs.promises.readFile(absolute);
    return { data: buffer, contentType: "application/octet-stream" };
  } catch {
    return { data: null, contentType: "application/octet-stream" };
  }
}

export async function storageDelete(key: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.storage.from(BUCKET_NAME).remove([key]);
    if (error) {
      console.error(`[storage] Supabase delete failed for ${key}:`, error);
    }
  }
  try {
    const absolute = resolveStoragePath(key);
    await fs.promises.unlink(absolute);
  } catch {
    // Local file may not exist; ignore.
  }
}

/**
 * Ensure the Supabase Storage bucket exists. Called once at startup.
 */
export async function ensureStorageBucket(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { data: buckets, error: listErr } =
      await supabase.storage.listBuckets();
    if (listErr) {
      console.warn("[storage] Could not list buckets:", listErr);
      return;
    }
    const exists = buckets?.some((b: { name: string }) => b.name === BUCKET_NAME);
    if (exists) return;
    const { error: createErr } = await supabase.storage.createBucket(
      BUCKET_NAME,
      {
        public: false,
        fileSizeLimit: 50 * 1024 * 1024,
      }
    );
    if (createErr) {
      console.warn(`[storage] Bucket create failed:`, createErr);
    } else {
      console.log(`[storage] Created Supabase Storage bucket: ${BUCKET_NAME}`);
    }
  } catch (err) {
    console.warn("[storage] ensureStorageBucket error:", err);
  }
}

/**
 * Absolute URL for a stored file. External consumers (e.g. the LLM provider
 * fetching image/PDF attachments) cannot resolve relative paths, so the
 * origin of the incoming request is prepended.
 */
export async function storageGetSignedUrl(
  relKey: string,
  baseUrl?: string
): Promise<string> {
  const { url } = await storageGet(relKey);
  if (!baseUrl) return url;
  return `${baseUrl.replace(/\/$/, "")}${url}`;
}

export function requestBaseUrl(req: {
  protocol?: string;
  headers: Record<string, unknown>;
}): string {
  const forwardedHost = req.headers["x-forwarded-host"];
  const forwardedProto = req.headers["x-forwarded-proto"];
  const host =
    (typeof forwardedHost === "string" && forwardedHost) ||
    (Array.isArray(forwardedHost) && forwardedHost[0]) ||
    req.headers.host;
  const proto =
    (typeof forwardedProto === "string" && forwardedProto.split(",")[0]) ||
    (Array.isArray(forwardedProto) && forwardedProto[0]) ||
    req.protocol ||
    "http";
  return host ? `${proto}://${host}` : "";
}
