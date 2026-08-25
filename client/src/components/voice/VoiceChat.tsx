import { useVoiceSession } from "@/hooks/useVoiceSession";
import React, { useEffect, useRef, useState } from "react";
import { VoiceControls } from "./VoiceControls";
import { VoiceOrb } from "./VoiceOrb";

export function VoiceChat({
  conversationId,
  onConversation,
  onExit,
  speechRate = 1,
}: {
  conversationId: string | null;
  onConversation: (conversationId: string) => void;
  onExit: () => void;
  speechRate?: number;
}) {
  const voice = useVoiceSession({ conversationId, onConversation, speechRate });
  const busy = voice.state === "processing" || voice.state === "speaking";
  const autoStartedRef = useRef(false);
  const [stateLabel, setStateLabel] = useState("");

  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    if (voice.continuousSupported) void voice.startListening();
    else void voice.startPushToTalk();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    switch (voice.state) {
      case "processing":
        setStateLabel("Thinking…");
        break;
      case "speaking":
        setStateLabel("Speaking…");
        break;
      default:
        setStateLabel("");
    }
  }, [voice.state]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (busy) voice.toggleMic();
      else {
        voice.exitAndCleanup();
        onExit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onExit, voice]);

  const caption =
    voice.subtitle || (voice.state === "listening" ? voice.interim : "");

  return (
    <section
      className="relative flex min-h-0 flex-1 animate-in fade-in zoom-in-[0.99] flex-col overflow-hidden duration-300"
      aria-label="Voice chat"
    >
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <VoiceOrb
          state={voice.state}
          levelRef={voice.levelRef}
          freqDataRef={voice.freqDataRef}
        />
        <div className="pointer-events-none absolute left-1/2 top-[calc(50%+9.5rem)] w-[min(88%,32rem)] -translate-x-1/2">
          {stateLabel && (
            <p className="mb-2 text-center text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
              {stateLabel}
            </p>
          )}
          <p
            className="max-h-24 overflow-hidden text-center text-[14px] leading-6 tracking-[-0.01em] text-foreground/60"
            aria-live="polite"
          >
            {caption}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-center gap-3 pb-9">
        {voice.error && (
          <p
            className="max-w-md text-center text-xs leading-5 text-destructive"
            role="alert"
          >
            {voice.error}
          </p>
        )}
        <div className="pt-1">
          <VoiceControls
            state={voice.state}
            onMicToggle={voice.toggleMic}
            onClose={() => {
              voice.exitAndCleanup();
              onExit();
            }}
          />
        </div>
      </div>
    </section>
  );
}
