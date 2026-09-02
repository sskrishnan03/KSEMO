import { type VoiceSessionState } from "@/hooks/useVoiceSession";
import { cn } from "@/lib/utils";

export function VoiceVisual({
  state,
  muted = false,
  levelRef,
  freqDataRef,
  className,
}: {
  state: VoiceSessionState;
  muted?: boolean;
  levelRef?: React.RefObject<number>;
  freqDataRef?: React.RefObject<Uint8Array>;
  className?: string;
}) {
  const label = muted
    ? "Microphone muted"
    : state === "processing"
      ? "KSEMO is thinking"
      : state === "speaking"
        ? "KSEMO is speaking"
        : state === "listening"
          ? "Listening"
          : "Ready";

  return (
    <div className={cn("relative", className)} role="img" aria-label={label}>
      <div className="absolute inset-0 rounded-full bg-black" />
    </div>
  );
}