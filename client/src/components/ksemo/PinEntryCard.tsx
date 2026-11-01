import { X } from "lucide-react";
import { PinDigitsInput } from "./PinDigitsInput";

export function PinEntryCard({
  title,
  description,
  value,
  length,
  onChange,
  onComplete,
  onClose,
  ariaLabel,
  error,
}: {
  title: string;
  description: string;
  value: string;
  length: 4 | 6;
  onChange: (value: string) => void;
  onComplete: (value: string) => void;
  onClose: () => void;
  ariaLabel: string;
  error?: string;
}) {
  return (
    <section className="relative flex w-[min(16rem,calc(100vw-3rem))] flex-col items-center gap-4 rounded-2xl border border-border bg-card px-5 py-6 text-center text-card-foreground shadow-lg">
      <button
        type="button"
        aria-label="Close PIN entry"
        title="Close"
        onClick={onClose}
        className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <X size={16} />
      </button>
      <div className="space-y-1">
        <h2 className="text-base font-semibold leading-5">{title}</h2>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <PinDigitsInput
        value={value}
        length={length}
        onChange={onChange}
        onComplete={onComplete}
        ariaLabel={ariaLabel}
        autoFocus
        appearance="ghost"
      />
      {error && <p role="alert" className="text-center text-xs text-destructive">{error}</p>}
    </section>
  );
}
