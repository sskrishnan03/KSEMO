import { useEffect, useState } from "react";
import { CloudDownload, Loader2, Search, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

type Provider = "google" | "microsoft";
type CloudFile = { id: string; name: string; mimeType?: string; size: number };
export function CloudDriveImport() {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<Provider>("google");
  const [query, setQuery] = useState("");
  const utils = trpc.useUtils();
  const status = trpc.cloud.status.useQuery(undefined, { enabled: open });
  const files = trpc.cloud.files.useQuery(
    { provider, query },
    {
      enabled:
        open &&
        Boolean(
          status.data?.find(item => item.provider === provider)?.connected
        ),
    }
  );
  const connect = trpc.cloud.connectUrl.useMutation({
    onSuccess: data => {
      window.location.assign(data.url);
    },
    onError: error => toast.error(error.message),
  });
  const importFile = trpc.cloud.importFile.useMutation({
    onSuccess: result => {
      toast.success(`Added ${result.filename} to your Library`);
      utils.workspace.files.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const disconnect = trpc.cloud.disconnect.useMutation({
    onSuccess: () => {
      utils.cloud.status.invalidate();
      utils.cloud.files.invalidate();
      toast.success("Cloud account disconnected");
    },
    onError: error => toast.error(error.message),
  });
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const drive = params.get("drive");
    if (!drive) return;
    setOpen(true);
    if (drive.startsWith("microsoft")) setProvider("microsoft");
    if (drive.endsWith("connected")) {
      toast.success(
        drive.startsWith("google")
          ? "Google Drive connected"
          : "OneDrive connected"
      );
      void utils.cloud.status.invalidate();
    }
    params.delete("drive");
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${params.size ? `?${params}` : ""}${window.location.hash}`
    );
  }, [utils.cloud.status]);
  const selected = status.data?.find(item => item.provider === provider);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-8 rounded-xl text-xs sm:h-9 sm:text-sm"
        onClick={() => setOpen(true)}
      >
        <CloudDownload className="mr-2 size-4" />
        Import from cloud
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-xl overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Import from cloud storage</DialogTitle>
            <DialogDescription>
              Connect Google Drive or OneDrive, then choose files to copy into
              your private Library. Nothing is imported until you select it.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={provider === "google" ? "default" : "outline"}
              onClick={() => setProvider("google")}
            >
              Google Drive
            </Button>
            <Button
              size="sm"
              variant={provider === "microsoft" ? "default" : "outline"}
              onClick={() => setProvider("microsoft")}
            >
              OneDrive
            </Button>
          </div>
          {status.isLoading ? (
            <Loader2 className="mx-auto my-8 size-5 animate-spin" />
          ) : !selected?.configured ? (
            <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
              This provider is not configured by the server yet.
            </p>
          ) : !selected.connected ? (
            <Button
              onClick={() => connect.mutate({ provider })}
              disabled={connect.isPending}
            >
              {connect.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Connect {provider === "google" ? "Google Drive" : "OneDrive"}
            </Button>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                <span className="truncate text-sm">
                  Connected{selected.email ? ` as ${selected.email}` : ""}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => disconnect.mutate({ provider })}
                >
                  <Unplug className="mr-2 size-4" />
                  Disconnect
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search cloud files"
                />
              </div>
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
                {files.isLoading ? (
                  <Loader2 className="mx-auto my-8 size-5 animate-spin" />
                ) : (files.data ?? []).length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No supported files found.
                  </p>
                ) : (
                  (files.data as CloudFile[] | undefined)?.map(
                    (file: CloudFile) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-muted/60"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {file.size
                              ? `${(file.size / 1024 / 1024).toFixed(1)} MB · `
                              : ""}
                            {file.mimeType || "File"}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            importFile.isPending || file.size > 25 * 1024 * 1024
                          }
                          onClick={() =>
                            importFile.mutate({
                              provider,
                              id: file.id,
                              name: file.name,
                              mimeType: file.mimeType,
                            })
                          }
                        >
                          {importFile.isPending ? "Importing…" : "Import"}
                        </Button>
                      </div>
                    )
                  )
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
