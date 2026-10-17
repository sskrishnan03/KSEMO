import { toast } from "sonner";
import { CircleX, X } from "lucide-react";

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
  onDismiss,
  status = "success",
}: {
  message: string;
  onDismiss: () => void;
  status?: "success" | "error";
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex w-max max-w-[min(24rem,calc(100vw-2rem))] items-center gap-3 rounded-lg bg-[#343434] px-4 py-3 text-white shadow-lg shadow-black/25"
    >
      {status === "success" ? (
        <CopySuccessIcon className="size-[17px] shrink-0" />
      ) : (
        <CircleX className="size-4 shrink-0" aria-hidden="true" />
      )}
      <p className="min-w-0 max-w-[min(20rem,calc(100vw-7rem))] whitespace-normal text-sm font-medium leading-5">
        {message}
      </p>
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

export function showActionNotice(message: string) {
  toast.custom(
    id => (
      <ActionNotice message={message} onDismiss={() => toast.dismiss(id)} />
    ),
    { duration: 4000 }
  );
}
