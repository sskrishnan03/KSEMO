import { useVoiceSession } from "@/hooks/useVoiceSession";
import { cn } from "@/lib/utils";
import { playVoiceChatStart, playVoiceChatStop } from "@/lib/recordingSounds";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { VoiceVisual } from "./VoiceVisual";

const MAX_CAPTION_CHARS = 160;

// Keeps the spoken caption compact for long answers: once it passes ~2 lines
// it shows only the newest words, so old text slides away instead of the note
// growing taller (the "coming and closing" effect).
function fitCaptionTail(text: string): string {
  if (text.length <= MAX_CAPTION_CHARS) return text;
  let start = text.length - MAX_CAPTION_CHARS;
  while (start < text.length && !/\s/.test(text[start])) start += 1;
  const tail = text.slice(start).trimStart();
  return tail.length > 0 ? tail : text.slice(-MAX_CAPTION_CHARS);
}

export function VoiceChat({
  conversationId,
  onConversation,
  onExit,
  speechRatePreference = 100,
  onSpeechRateChange,
  composer,
}: {
  conversationId: string | null;
  onConversation: (conversationId: string) => void;
  onExit: () => void;
  speechRatePreference?: number;
  onSpeechRateChange?: (rate: number) => void;
  composer?: React.ReactNode;
}) {
  const speechRate = speechRatePreference / 100;
  const voice = useVoiceSession({
    conversationId,
    onConversation,
    speechRate,
  });
  const autoStartedRef = useRef(false);
  const [micOff, setMicOff] = useState(false);

  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    playVoiceChatStart();
    if (voice.continuousSupported) void voice.startListening();
    else void voice.startPushToTalk();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestExit = useCallback(() => {
    playVoiceChatStop();
    voice.exitAndCleanup();
    onExit();
  }, [onExit, voice]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      requestExit();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [requestExit]);

  const handleMicToggle = useCallback(() => {
    const nextMuted = !micOff;
    setMicOff(nextMuted);
    voice.setMuted(nextMuted);
  }, [micOff, voice]);

  const mutedHint = micOff && voice.state === "idle" && !voice.error;
  const captionText = voice.error
    ? voice.error
    : mutedHint
      ? "Microphone muted — tap the microphone to unmute and talk."
      : voice.state === "speaking"
        ? fitCaptionTail(voice.subtitle)
        : "";

  const composerWithVoiceControls = useMemo(() => {
    if (!composer) return null;
    if (!React.isValidElement<Record<string, unknown>>(composer)) return composer;
    return React.cloneElement(composer, {
      voiceChatActive: true,
      voiceChatMuted: micOff,
      onVoiceChatMicToggle: handleMicToggle,
      onVoiceChatEnd: requestExit,
      onSend: (content: string) => {
        if (content.trim()) voice.sendText(content);
      },
      voices: voice.voices.map(availableVoice => ({
        name: availableVoice.name,
        lang: availableVoice.lang,
        default: availableVoice.default,
      })),
      selectedVoiceName: voice.selectedVoiceName,
      onVoiceChatVoiceSelect: voice.setVoiceName,
    } as Record<string, unknown>);
  }, [
    composer,
    micOff,
    handleMicToggle,
    requestExit,
    voice.voices,
    voice.selectedVoiceName,
    voice.setVoiceName,
    voice.sendText,
  ]);

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col overflow-hidden bg-background"
      role="region"
      aria-label="Voice chat mode"
    >
      <div className="relative min-h-0 flex-1">
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          aria-hidden
        >
          <div className="aspect-square h-[clamp(6rem,34%,13.5rem)]">
            <VoiceVisual
              state={voice.state}
              muted={micOff}
              levelRef={voice.levelRef}
              freqDataRef={voice.freqDataRef}
              className="h-full w-full"
            />
          </div>
        </div>
        {captionText && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-4">
            <p
              className={cn(
                "max-h-24 max-w-xl overflow-hidden text-center text-sm leading-6 tracking-tight",
                voice.error ? "text-destructive" : "text-foreground/60"
              )}
              aria-live="polite"
            >
              {captionText}
            </p>
          </div>
        )}
      </div>

      {composerWithVoiceControls && (
        <div className="relative z-20 shrink-0">{composerWithVoiceControls}</div>
      )}
    </div>
  );
}