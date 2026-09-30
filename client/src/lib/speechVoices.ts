import { useEffect, useState } from "react";

/** The bits of SpeechSynthesisVoice the composer's voice picker needs. */
export type ReplyVoice = {
  name: string;
  lang: string;
  default: boolean;
};

/** Where Bot's reply voice choice lives so it survives reloads. */
const STORAGE_KEY = "ksemo:bot-voice-name";

function getSynth(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }
  return window.speechSynthesis;
}

export function getReplyVoices(): ReplyVoice[] {
  const synth = getSynth();
  if (!synth) return [];
  return synth.getVoices().map(voice => ({
    name: voice.name,
    lang: voice.lang,
    default: voice.default,
  }));
}

/**
 * The bot's reply voice, chosen from the system's speech voices. Listens for
 * voiceschanged (voices load asynchronously), and persists the selection so the
 * voice chat keeps the pick in the next session. Safe to run in SSR/tests where
 * SpeechSynthesis simply does not exist — it reports no voices and a null pick.
 */
export function useBotReplyVoice() {
  const [voices, setVoices] = useState<ReplyVoice[]>(() => getReplyVoices());
  const [voiceName, setVoiceNameState] = useState<string | null>(() => {
    if (typeof window === "undefined" || !("localStorage" in window)) {
      return null;
    }
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const synth = getSynth();
    if (!synth) return;
    const load = () => setVoices(getReplyVoices());
    load();
    synth.addEventListener("voiceschanged", load);
    return () => synth.removeEventListener("voiceschanged", load);
  }, []);

  function setVoiceName(next: string | null) {
    setVoiceNameState(next);
    if (typeof window === "undefined" || !("localStorage" in window)) return;
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, next);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage can be blocked; the selection just won't persist.
    }
  }

  return { voices, voiceName, setVoiceName };
}
