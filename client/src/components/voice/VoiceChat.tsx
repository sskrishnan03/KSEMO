import { useVoiceSession } from "@/hooks/useVoiceSession";
import React, { useEffect, useRef } from "react";
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

  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    if (voice.continuousSupported) void voice.startListening();
    else void voice.startPushToTalk();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <VoiceOrb state={voice.state} levelRef={voice.levelRef} />
        <div className="pointer-events-none absolute left-1/2 top-[calc(50%+8.9rem)] w-[min(92%,36rem)] -translate-x-1/2">
          <p
            className="max-h-32 overflow-hidden text-center text-[15px] leading-7 tracking-[-0.01em] text-foreground/90"
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
