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

// Smoothly update caption to avoid jumping backwards
function getSmoothCaption(fullText: string, previousText: string): string {
  if (fullText.length <= MAX_CAPTION_CHARS) return fullText;
  
  // If the new text is just an extension of previous text, show the end
  if (fullText.startsWith(previousText) && previousText.length > 0) {
    const tailLength = MAX_CAPTION_CHARS;
    const start = Math.max(0, fullText.length - tailLength);
    while (start > 0 && !/\s/.test(fullText[start - 1])) start -= 1;
    return fullText.slice(start).trimStart();
  }
  
  // Otherwise use the normal tail function
  return fitCaptionTail(fullText);
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
  const [previousSubtitle, setPreviousSubtitle] = useState("");

  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    playVoiceChatStart();
    if (voice.continuousSupported) void voice.startListening();
    else void voice.startPushToTalk();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track subtitle changes for smooth transitions
  useEffect(() => {
    if (voice.state === "speaking" && voice.subtitle) {
      setPreviousSubtitle(voice.subtitle);
    } else if (voice.state !== "speaking") {
      setPreviousSubtitle("");
    }
  }, [voice.state, voice.subtitle]);

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
        ? getSmoothCaption(voice.subtitle, previousSubtitle)
        : "";

  const composerWithVoiceControls = useMemo(() => {
    if (!composer) return null;
    if (!React.isValidElement<Record<string, unknown>>(composer)) return composer;
    
    const composerProps = composer.props as Record<string, unknown>;
    const originalOnSend = composerProps.onSend as ((content: string) => void) | undefined;
    
    return React.cloneElement(composer, {
      voiceChatActive: true,
      voiceChatMuted: micOff,
      onVoiceChatMicToggle: handleMicToggle,
      onVoiceChatEnd: requestExit,
      onSend: (content: string) => {
        if (content.trim()) {
          // Handle attachments in voice chat
          const attachmentNotices = composerProps.attachmentNotices as Array<{fileId: string, name: string, mimeType?: string, url?: string}> | undefined;
          const attachmentNotice = composerProps.attachmentNotice as {fileId: string, name: string, mimeType?: string, url?: string} | undefined;
          
          // Collect all attachments
          let attachments: Array<{fileId: string, name: string, mimeType?: string, url?: string}> = [];
          
          if (attachmentNotices && attachmentNotices.length > 0) {
            attachments = [...attachmentNotices];
            console.log('[VoiceChat] Sending with attachmentNotices:', attachments);
          } else if (attachmentNotice) {
            attachments = [attachmentNotice];
            console.log('[VoiceChat] Sending with attachmentNotice:', attachments);
          } else {
            console.log('[VoiceChat] No attachments found');
          }
          
          // Send via voice chat with attachments
          if (attachments.length > 0) {
            // Clear attachments after sending
            if (composerProps.onClearAttachment) {
              (composerProps.onClearAttachment as () => void)();
            }
            voice.sendText(content, attachments);
          } else {
            // If no attachments, use voice chat send
            voice.sendText(content);
          }
        }
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
    composer?.props,
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