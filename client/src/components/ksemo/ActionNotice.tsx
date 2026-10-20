import { toast } from "sonner";
import { CircleX, ExternalLink, X } from "lucide-react";

export function CopySuccessIcon({
  className = "size-[17px]",
}: {
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={`ksemo-copy-success ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        className="ksemo-copy-success-circle"
        cx="12"
        cy="12"
        r="10.5"
      />
      <path
        className="ksemo-copy-success-tick"
        d="m6.5 12.5 4 4 7.5-8"
      />
    </svg>
  );
}

export function ActionNotice({
  message,
  href,
  onDismiss,
  status = "success",
}: {
  message: string;
  href?: string;
  onDismiss: () => void;
  status?: "success" | "error";
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex w-max max-w-[min(30rem,calc(100vw-1rem))] items-center gap-2 rounded-lg bg-[#343434] px-3 py-3 text-white shadow-lg shadow-black/25"
    >
      {status === "success" ? (
        <CopySuccessIcon className="size-[17px] shrink-0" />
      ) : (
        <CircleX className="size-4 shrink-0" aria-hidden="true" />
      )}
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm font-normal leading-5">
        <p className="shrink-0 whitespace-nowrap">{message}</p>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sky-300 underline decoration-sky-300/70 underline-offset-2 hover:text-sky-200"
          >
            Open <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss message"
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function showActionNotice(message: string, href?: string) {
  toast.custom(
    id => (
      <ActionNotice
        message={message}
        href={href}
        onDismiss={() => toast.dismiss(id)}
      />
    ),
    { duration: 5000 }
  );
}
