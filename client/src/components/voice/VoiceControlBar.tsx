import { type VoiceSessionState } from "@/hooks/useVoiceSession";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, Mic, MicOff, Settings2, X } from "lucide-react";

const SPEECH_RATES = [
  { label: "Calm", value: 75 },
  { label: "Normal", value: 100 },
  { label: "Snappier", value: 125 },
  { label: "Fast", value: 150 },
];

const TONES: Record<string, { dot: string; glow: string }> = {
  emerald: { dot: "bg-emerald-400", glow: "bg-emerald-400/60" },
  amber: { dot: "bg-amber-400", glow: "bg-amber-400/60" },
  violet: { dot: "bg-indigo-300", glow: "bg-indigo-400/60" },
  slate: { dot: "bg-muted-foreground/70", glow: "bg-muted-foreground/40" },
};

function statusMeta(state: VoiceSessionState, muted: boolean) {
  switch (state) {
    case "processing":
      return { label: "Thinking", tone: "amber", active: true };
    case "speaking":
      return { label: "Speaking", tone: "violet", active: true };
    case "listening":
      return { label: "Listening", tone: "emerald", active: true };
    default:
      return muted
        ? { label: "Microphone muted", tone: "slate", active: false }
        : { label: "Ready", tone: "slate", active: false };
  }
}

function BarButton({
  label,
  onClick,
  disabled,
  active,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          aria-pressed={active}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200",
            "hover:bg-accent hover:text-foreground",
            "disabled:pointer-events-none disabled:opacity-40",
            active && "bg-accent text-foreground",
            className
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function VoiceControlBar({
  state,
  muted,
  onMicToggle,
  onEnd,
  speechRate,
  onSpeechRateChange,
}: {
  state: VoiceSessionState;
  muted: boolean;
  onMicToggle: () => void;
  onEnd: () => void;
  speechRate: number;
  onSpeechRateChange: (rate: number) => void;
}) {
  const meta = statusMeta(state, muted);
  const tone = TONES[meta.tone];
  const micBusy = state === "processing" || state === "speaking";
  const currentRate = SPEECH_RATES.reduce(
    (best, rate) =>
      Math.abs(rate.value - speechRate) < Math.abs(best.value - speechRate)
        ? rate
        : best,
    SPEECH_RATES[1]
  );

  return (
    <div
      role="toolbar"
      aria-label="Voice chat controls"
      className="flex w-max max-w-full items-center gap-0.5 rounded-full border border-border/70 bg-card/85 p-1 shadow-[0_10px_34px_rgba(0,0,0,0.18)] backdrop-blur-xl"
    >
      <div className="flex min-w-0 items-center gap-2 pl-2.5 pr-1.5">
        <span className="relative flex size-1.5 shrink-0">
          {meta.active && (
            <span
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
                tone.glow
              )}
            />
          )}
          <span className={cn("relative inline-flex size-1.5 rounded-full", tone.dot)} />
        </span>
        <span className="whitespace-nowrap text-[11px] font-medium tracking-tight text-foreground/85">
          {meta.label}
        </span>
      </div>

      <div className="mx-0.5 h-5 w-px bg-border/70" />

      <BarButton
        label={
          micBusy
            ? "Stays on while KSEMO is responding"
            : muted
              ? "Unmute microphone"
              : "Mute microphone"
        }
        onClick={onMicToggle}
        disabled={micBusy}
        active={!muted && state !== "idle"}
      >
        {muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
      </BarButton>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Voice settings"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
          >
            <Settings2 className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="bottom" sideOffset={10} className="w-48">
          <DropdownMenuLabel>Speech rate</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {SPEECH_RATES.map(rate => (
            <DropdownMenuItem
              key={rate.value}
              onSelect={() => onSpeechRateChange(rate.value)}
            >
              <span>{rate.label}</span>
              {rate.value === currentRate.value && (
                <Check className="ml-auto size-3.5" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <p className="px-2 pb-1.5 pt-0.5 text-[10px] leading-4 text-muted-foreground/70">
            Applies to KSEMO&apos;s spoken replies.
          </p>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="mx-0.5 h-5 w-px bg-border/70" />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onEnd}
            aria-label="End voice chat"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={10}>
          End voice chat
        </TooltipContent>
      </Tooltip>
    </div>
  );
}