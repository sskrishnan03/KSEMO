import { cn } from "@/lib/utils";

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
        fullScreen ? "min-h-screen w-full bg-background" : "h-full min-h-24 w-full",
        className
      )}
    >
      <div className="loader text-foreground" aria-hidden />
    </div>
  );
}
