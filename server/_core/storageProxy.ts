import type { Express, Request, Response } from "express";
import fs from "fs";
import { resolveStoragePath } from "../storage";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
    ".csv": "text/csv; charset=utf-8",
    ".json": "application/json",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".mp4": "video/mp4",
  ".zip": "application/zip",
};

export function registerStorageProxy(app: Express) {
  app.use("/ksemo-storage", (req: Request, res: Response) => {
    const key = decodeURIComponent(req.url.replace(/^\/+/, ""));
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    let absolute: string;
    try {
      absolute = resolveStoragePath(key);
    } catch {
      res.status(400).send("Invalid storage key");
      return;
    }

    fs.stat(absolute, (statErr, stats) => {
      if (statErr || !stats.isFile()) {
        res.status(404).send("File not found");
        return;
      }
      const ext = key.slice(key.lastIndexOf(".")).toLowerCase();
      res.set("Content-Type", MIME_TYPES[ext] ?? "application/octet-stream");
      res.set("Content-Length", String(stats.size));
      res.set("Cache-Control", "no-store");
      fs.createReadStream(absolute).pipe(res);
    });
  });
}
