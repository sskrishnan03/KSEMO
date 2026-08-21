import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type VoiceSessionState } from "@/hooks/useVoiceSession";
import { Mic, MicOff, X } from "lucide-react";

export function VoiceControls({
  state,
  onMicToggle,
  onClose,
}: {
  state: VoiceSessionState;
  onMicToggle: () => void;
  onClose: () => void;
}) {
  const muted = state === "idle";
  const micLabel = muted
    ? "Unmute microphone"
    : state === "listening"
      ? "Mute microphone"
      : "Stop and mute microphone";
  const MicIcon = muted ? MicOff : Mic;
  return (
    <div className="flex items-center justify-center gap-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={onClose}
            className="size-11 rounded-full border-border bg-card/60 text-foreground hover:bg-muted"
            aria-label="End voice chat"
          >
            <X className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={12}>
          End voice chat
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={onMicToggle}
            className="size-11 rounded-full border-border bg-card/60 text-foreground hover:bg-muted"
            aria-label={micLabel}
            aria-pressed={!muted}
          >
            <MicIcon className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={12}>
          {micLabel}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
