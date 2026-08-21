import { Button } from "@/components/ui/button";
import React from "react";

export function MessageHistoryDialogPanel({
  versions,
  loading,
  restoring,
  onRestore,
}: {
  versions: Array<{ id: string; content: string; createdAt: Date }>;
  loading: boolean;
  restoring: boolean;
  onRestore: (id: string, content: string) => void;
}) {
  return (
    <div className="space-y-2">
      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Loading version history…
        </p>
      ) : versions.length ? (
        versions.map((version, index) => (
          <div key={version.id} className="rounded-xl border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium">
                Earlier version {versions.length - index}
              </p>
              <time className="text-[11px] text-muted-foreground">
                {new Date(version.createdAt).toLocaleString()}
              </time>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
              {version.content}
            </p>
            <div className="mt-3 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRestore(version.id, version.content)}
                disabled={restoring}
                className="rounded-lg"
              >
                {restoring ? "Restoring…" : "Restore and regenerate"}
              </Button>
            </div>
          </div>
        ))
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No earlier versions are available for this message.
        </p>
      )}
    </div>
  );
}
