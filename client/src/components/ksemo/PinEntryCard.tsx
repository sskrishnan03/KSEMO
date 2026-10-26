import { LockKeyhole, X } from "lucide-react";
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
    <section className="relative flex w-[min(18rem,calc(100vw-3rem))] flex-col items-center gap-4 rounded-2xl bg-[#242424] px-5 py-6 text-center text-white shadow-lg">
      <button
        type="button"
        aria-label="Close PIN entry"
        title="Close"
        onClick={onClose}
        className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-md text-white/65 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X size={16} />
      </button>
      <span className="flex size-10 items-center justify-center rounded-full bg-[#3b3b3b] text-white">
        <LockKeyhole size={19} strokeWidth={1.8} />
      </span>
      <div className="space-y-1">
        <h2 className="text-base font-semibold leading-5">{title}</h2>
        <p className="text-xs leading-5 text-white/65">{description}</p>
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
