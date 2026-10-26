import React, { useEffect, useRef } from "react";

export function PinDigitsInput({
  value,
  length,
  onChange,
  onComplete,
  ariaLabel,
  autoFocus = false,
  appearance = "default",
}: {
  value: string;
  length: 4 | 6;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  ariaLabel: string;
  autoFocus?: boolean;
  appearance?: "default" | "ghost";
}) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const lastCompletedValue = useRef<string | null>(null);

  useEffect(() => {
    if (autoFocus) inputs.current[0]?.focus();
  }, [autoFocus]);

  const replaceDigit = (index: number, digits: string) => {
    const next = value.split("");
    const start = Math.min(index, next.length);
    if (!digits) {
      if (index < next.length) next.splice(index, 1);
    }
    else {
      for (let offset = 0; offset < digits.length && start + offset < length; offset++) {
        next[start + offset] = digits[offset]!;
      }
    }
    const result = next.join("").slice(0, length);
    onChange(result);
    if (result.length === length) {
      if (lastCompletedValue.current !== result) {
        lastCompletedValue.current = result;
        onComplete?.(result);
      }
    } else {
      lastCompletedValue.current = null;
    }
    return Math.min(length - 1, start + digits.length);
  };

  return (
    <div className={`flex items-center justify-center ${length === 6 || appearance === "ghost" ? "gap-2" : "gap-3"}`} role="group" aria-label={ariaLabel}>
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={node => { inputs.current[index] = node; }}
          type="password"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`${ariaLabel}, digit ${index + 1}`}
          value={value[index] ?? ""}
          onChange={event => {
            const digits = event.target.value.replace(/\D/g, "");
            if (!digits) {
              replaceDigit(index, "");
              return;
            }
            const focusIndex = replaceDigit(index, digits.slice(-length));
            inputs.current[focusIndex]?.focus();
          }}
          onKeyDown={event => {
            if (event.key === "Backspace") {
              event.preventDefault();
              if (value[index]) replaceDigit(index, "");
              else if (index > 0) {
                replaceDigit(index - 1, "");
                inputs.current[index - 1]?.focus();
              }
            } else if (event.key === "ArrowLeft" && index > 0) {
              event.preventDefault();
              inputs.current[index - 1]?.focus();
            } else if (event.key === "ArrowRight" && index < length - 1) {
              event.preventDefault();
              inputs.current[index + 1]?.focus();
            }
          }}
          onPaste={event => {
            const digits = event.clipboardData.getData("text").replace(/\D/g, "");
            if (!digits) return;
            event.preventDefault();
            const focusIndex = replaceDigit(index, digits.slice(0, length - index));
            inputs.current[focusIndex]?.focus();
          }}
          className={`${appearance === "ghost" ? (length === 6 ? "size-9 text-base" : "h-12 w-9 text-lg") : (length === 6 ? "size-9 text-base" : "h-12 w-11 text-lg")} ${appearance === "ghost" ? "rounded-xl border-b border-border/80 bg-[#141414] text-white focus:bg-[#141414] focus-visible:border-b-foreground/50 focus-visible:ring-0" : "rounded-lg bg-muted/60 text-foreground focus:bg-accent/70"} text-center font-semibold outline-none transition-colors`}
        />
      ))}
    </div>
  );
}
