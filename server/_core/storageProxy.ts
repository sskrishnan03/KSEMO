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
  ".json": "application/json",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".mp4": "video/mp4",
  ".zip": "application/zip",
};

export function registerStorageProxy(app: Express) {
  app.use("/ksemo-storage", (req: Request, res: Response) => {
    const rawPath = (req.path || req.url.split("?")[0]).replace(/^\/+/, "");
    const key = decodeURIComponent(rawPath);
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

      // Strip internal hash suffix (e.g., "Report_94fa21cb.pdf" -> "Report.pdf") or use custom requested filename
      const customFilename = req.query.filename ? String(req.query.filename).trim() : null;
      const cleanKeyFilename = key.replace(/_[a-f0-9]{8}(\.[^.]+)$/i, "$1");
      const targetFilename = customFilename || cleanKeyFilename;
      const safeAscii = targetFilename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, '\\"');
      const utf8Encoded = encodeURIComponent(targetFilename);

      const isDownload = req.query.download === "1" || Boolean(customFilename);
      const dispositionType = isDownload ? "attachment" : "inline";
      res.set(
        "Content-Disposition",
        `${dispositionType}; filename="${safeAscii}"; filename*=UTF-8''${utf8Encoded}`
      );

      fs.createReadStream(absolute).pipe(res);
    });
  });
}
