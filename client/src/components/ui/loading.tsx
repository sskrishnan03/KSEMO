import { cn } from "@/lib/utils";

export const AUTH_LOADING_MIN_MS = 3200;

export function holdForRealisticLoading(startedAt: number) {
  const remaining = AUTH_LOADING_MIN_MS - (Date.now() - startedAt);
  if (remaining <= 0) return Promise.resolve();
  return new Promise<void>(resolve => setTimeout(resolve, remaining));
}

export function Loading({
  fullScreen = false,
  className,
  label = "Loading",
}: {
  fullScreen?: boolean;
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        "grid place-items-center",
        fullScreen
          ? "min-h-screen w-full bg-background"
          : "h-full min-h-24 w-full",
        className
      )}
    >
      <div className="loader text-foreground" aria-hidden />
    </div>
  );
}

export function CenteredLoading({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] grid place-items-center bg-background"
    >
      <div className="flex items-center gap-3">
        <div className="loader text-foreground" aria-hidden />
        <p className="text-sm font-medium text-foreground">{label}</p>
      </div>
    </div>
  );
}
