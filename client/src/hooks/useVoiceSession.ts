import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAuthHeaders } from "@/lib/authHeaders";
import { currentTimeZone } from "@/lib/timeZone";

export type VoiceSessionState =
  | "idle"
  | "listening"
  | "processing"
  | "speaking";

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
  length: number;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
};
type SpeechRecognitionErrorEventLike = { error: string };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

function chooseRecorderType() {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  return candidates.find(type => MediaRecorder.isTypeSupported(type)) ?? null;
}

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined")
    return false;
  const ua = navigator.userAgent;
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
    (("ontouchstart" in window || navigator.maxTouchPoints > 0) &&
      (window.screen?.width ?? 1024) <= 768)
  );
}

async function toBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    const end = Math.min(offset + chunk, bytes.length);
    for (let index = offset; index < end; index += 1)
      binary += String.fromCharCode(bytes[index]);
  }
  return window.btoa(binary);
}

// Strip markdown syntax, symbols, emojis, and code artifacts so speech sounds natural & conversational
export function cleanTextForSpeech(text: string): string {
  return text
    // Remove markdown code blocks
    .replace(/```[\s\S]*?```/g, "")
    // Remove inline code backticks
    .replace(/`([^`]+)`/g, "$1")
    // Remove markdown links: [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove raw URLs
    .replace(/https?:\/\/\S+/g, "")
    // Remove markdown bold/italic asterisks & underscores
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1")
    // Remove markdown headers: # Header -> Header
    .replace(/^#{1,6}\s+/gm, "")
    // Remove blockquotes: > Quote -> Quote
    .replace(/^>\s+/gm, "")
    // Remove bullet points & list symbols
    .replace(/[•●○■□▪▫]/g, " ")
    .replace(/^\s*[-*]\s+/gm, "")
    // Remove numbering at line start: 1. -> ""
    .replace(/^\s*\d+\.\s+/gm, "")
    // Remove emoji characters so speech synthesizers don't read out emoji names
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
    // Replace currency and symbols with natural spoken equivalents
    .replace(/\$(\d+(?:\.\d+)?)/g, "$1 dollars")
    .replace(/\$/g, " dollars ")
    .replace(/\s*&\s*/g, " and ")
    .replace(/\s*%\s*/g, " percent ")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

// Selects the highest quality natural, human-like voice available on this device
export function selectBestHumanVoice(
  voices: SpeechSynthesisVoice[],
  preferredName?: string | null
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;

  if (preferredName) {
    const matched = voices.find(v => v.name === preferredName);
    if (matched) return matched;
  }

  const userLang = (typeof navigator !== "undefined" ? navigator.language || "en" : "en")
    .slice(0, 2)
    .toLowerCase();

  const priorityScore = (v: SpeechSynthesisVoice): number => {
    const name = v.name.toLowerCase();
    const lang = v.lang.toLowerCase();
    let score = 0;

    if (lang.startsWith(userLang)) score += 60;
    else if (lang.startsWith("en")) score += 30;
    else return -100;

    // Neural / Natural Online voices (Edge/Windows, Chrome, macOS) sound like real humans
    if (name.includes("natural") || name.includes("neural") || name.includes("online (natural)")) {
      score += 120;
    }
    if (name.includes("enhanced") || name.includes("premium")) {
      score += 90;
    }
    if (name.includes("google")) {
      score += 80;
    }

    // Known warm conversational voices
    if (/jenny|aria|guy|sonia|natasha|christopher|roger|steffan|ava|oliver|samantha/i.test(name)) {
      score += 45;
    }

    if (v.default) score += 10;

    // Deprioritize robotic legacy desktop synthesizers (like Microsoft David)
    if (name.includes("david") || (name.includes("desktop") && !name.includes("natural"))) {
      score -= 50;
    }

    return score;
  };

  const scored = [...voices]
    .map(v => ({ voice: v, score: priorityScore(v) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
    return scored[0].voice;
  }

  return (
    voices.find(v => v.lang.toLowerCase().startsWith("en")) ??
    voices.find(v => v.default) ??
    voices[0] ??
    null
  );
}

const TURN_SILENCE_MS = 750;
const INTERIM_COMMIT_MS = 800;

export function useVoiceSession(options: {
  conversationId: string | null;
  onConversation: (conversationId: string) => void;
  speechRate?: number;
  voiceName?: string | null;
}) {
  const { conversationId, onConversation, speechRate = 1, voiceName = null } =
    options;
  const [state, setState] = useState<VoiceSessionState>("idle");
  const [voiceList, setVoiceList] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string | null>(
    voiceName
  );
  const preferredVoiceNameRef = useRef<string | null>(voiceName);
  useEffect(() => {
    preferredVoiceNameRef.current = selectedVoiceName;
  }, [selectedVoiceName]);
  const [interim, setInterim] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fallbackRecording, setFallbackRecording] = useState(false);
  const levelRef = useRef(0);
  const freqDataRef = useRef<Uint8Array>(new Uint8Array(64));

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const conversationIdRef = useRef(conversationId);
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wantListeningRef = useRef(false);
  const recognitionActiveRef = useRef(false);
  const turnActiveRef = useRef(false);
  const unmountedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const turnTimerRef = useRef<number | null>(null);
  const sessionStartedRef = useRef(false);
  const speakPendingRef = useRef(0);
  const streamOpenRef = useRef(false);
  const drainResolverRef = useRef<(() => void) | null>(null);
  const lastSpeakStartRef = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const activeUtterancesRef = useRef<Set<SpeechSynthesisUtterance>>(new Set());
  const fullReplyRef = useRef("");
  const subtitleCharRef = useRef(0);
  const subtitleTimerRef = useRef<number | null>(null);
  const enqueuedLenRef = useRef(0);
  const boundarySeenRef = useRef(false);
  const keepaliveRef = useRef<number | null>(null);
  const lastAdvanceRef = useRef(0);
  const interimRef = useRef("");
  const lastVoiceEventRef = useRef(0);
  const watchdogRef = useRef<number | null>(null);
  const mobileRestartCountRef = useRef(0);
  const recognitionNetworkFailuresRef = useRef(0);
  const lastLevelAtRef = useRef(0);
  const captureModeRef = useRef<"recognition" | "capture" | "none">("none");

  const continuousSupported =
    typeof window !== "undefined" && getRecognitionCtor() !== null;

  const sessionStartMutation = trpc.voice.sessionStart.useMutation();
  const transcribeMutation = trpc.voice.transcribe.useMutation();

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      const picked = selectBestHumanVoice(voices, preferredVoiceNameRef.current);
      voiceRef.current = picked;
      if (preferredVoiceNameRef.current === null && picked) {
        preferredVoiceNameRef.current = picked.name;
        setSelectedVoiceName(picked.name);
      }
    };
    const refreshVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setVoiceList(voices);
      pickVoice();
    };
    refreshVoices();
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", refreshVoices);
  }, []);

  const setVoiceName = useCallback((name: string) => {
    setSelectedVoiceName(name);
    preferredVoiceNameRef.current = name;
    if (!("speechSynthesis" in window)) return;
    const match = window.speechSynthesis
      .getVoices()
      .find(voice => voice.name === name);
    if (match) voiceRef.current = match;
  }, []);

  const releaseMicMeter = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    analyserRef.current = null;
    if (audioContextRef.current?.state !== "closed")
      void audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    levelRef.current = 0;
  }, []);

  const stopRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recognitionActiveRef.current = false;
    try {
      recognition?.abort();
    } catch {
      /* already stopped */
    }
  }, []);

  const stopSubtitleTimer = useCallback(() => {
    if (subtitleTimerRef.current !== null) {
      window.clearInterval(subtitleTimerRef.current);
      subtitleTimerRef.current = null;
    }
  }, []);

  const clearSubtitles = useCallback(() => {
    stopSubtitleTimer();
    subtitleCharRef.current = 0;
    enqueuedLenRef.current = 0;
    boundarySeenRef.current = false;
    lastAdvanceRef.current = 0;
    setSubtitle("");
  }, [stopSubtitleTimer]);

  const startKeepalive = useCallback(() => {
    if (keepaliveRef.current !== null) return;
    keepaliveRef.current = window.setInterval(() => {
      if ("speechSynthesis" in window && speakPendingRef.current > 0) {
        window.speechSynthesis.resume();
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 8_000);
  }, []);

  const stopKeepalive = useCallback(() => {
    if (keepaliveRef.current !== null) {
      window.clearInterval(keepaliveRef.current);
      keepaliveRef.current = null;
    }
  }, []);

  const stopWatchdog = useCallback(() => {
    if (watchdogRef.current !== null) {
      window.clearInterval(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const startWatchdog = useCallback(() => {
    if (watchdogRef.current !== null) return;
    watchdogRef.current = window.setInterval(() => {
      if (
        stateRef.current !== "listening" ||
        turnActiveRef.current ||
        !wantListeningRef.current
      )
        return;
      if (analyserRef.current) {
        if (levelRef.current > 0.08) lastLevelAtRef.current = Date.now();
        if (
          Date.now() - lastVoiceEventRef.current > 8000 &&
          Date.now() - lastLevelAtRef.current < 8000
        ) {
          console.warn(
            "[Voice] Recognition stalled while the mic heard speech, switching to capture fallback"
          );
          wantListeningRef.current = false;
          stopRecognition();
          stopWatchdog();
          captureModeRef.current = "capture";
          interimRef.current = "";
          setInterim("");
          stateRef.current = "idle";
          setState("idle");
          void startPushToTalk();
          return;
        }
      }
      const text = interimRef.current.trim();
      if (!text || Date.now() - lastVoiceEventRef.current < INTERIM_COMMIT_MS)
        return;
      interimRef.current = "";
      setInterim("");
      void handleTurn(text);
    }, 180);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishTurn = useCallback(() => {
    turnActiveRef.current = false;
    if (unmountedRef.current) return;
    if (wantListeningRef.current) {
      setState("listening");
      setInterim("");
      interimRef.current = "";
      lastVoiceEventRef.current = Date.now();
      if (continuousSupported) {
        window.setTimeout(() => {
          if (
            unmountedRef.current ||
            !wantListeningRef.current ||
            turnActiveRef.current ||
            recognitionActiveRef.current ||
            recognitionRef.current
          )
            return;
          startRecognitionInternal();
        }, 450);
      }
    } else if (captureModeRef.current === "capture") {
      setState("idle");
      window.setTimeout(() => {
        if (
          unmountedRef.current ||
          stateRef.current !== "idle" ||
          turnActiveRef.current
        )
          return;
        void startPushToTalk();
      }, 400);
    } else {
      setState("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continuousSupported]);

  function startRecognitionInternal() {
    if (
      unmountedRef.current ||
      !wantListeningRef.current ||
      recognitionRef.current ||
      recognitionActiveRef.current
    )
      return;
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = event => {
      lastVoiceEventRef.current = Date.now();
      recognitionNetworkFailuresRef.current = 0;
      let finalText = "";
      let interimText = "";
      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      if (stateRef.current === "speaking") {
        if (finalText.trim()) {
          interruptSpeaking();
          setInterim("");
          interimRef.current = "";
          scheduleTurn(finalText.trim());
        }
        return;
      }
      if (finalText.trim()) {
        if (isMobileDevice()) mobileRestartCountRef.current = 0;
        setInterim("");
        interimRef.current = "";
        scheduleTurn(finalText.trim());
      } else if (interimText.trim()) {
        interimRef.current = interimText;
        setInterim(interimText);
      }
    };
    recognition.onerror = event => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      recognitionActiveRef.current = false;
      if (process.env.NODE_ENV !== "production")
        console.log("[Voice] Recognition error:", event.error);
      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        hardStopInternal();
        setError(
          "Microphone access is blocked. Allow microphone access for KSEMO in your browser settings, then try again."
        );
      } else if (event.error === "audio-capture") {
        hardStopInternal();
        setError(
          isMobileDevice()
            ? "The microphone is unavailable. Close other apps using the microphone and try again."
            : "Could not access the microphone. Check that it is connected and not in use by another app."
        );
      } else if (event.error === "network") {
        console.warn("[Voice] Speech recognition network error; scheduling fresh instance restart");
        recognitionNetworkFailuresRef.current += 1;
        if (recognitionNetworkFailuresRef.current >= 3) {
          console.warn(
            "[Voice] Speech recognition keeps failing on network errors, switching to capture fallback"
          );
          wantListeningRef.current = false;
          stopRecognition();
          stopWatchdog();
          captureModeRef.current = "capture";
          stateRef.current = "idle";
          setState("idle");
          setInterim("");
          interimRef.current = "";
          void startPushToTalk();
          return;
        }
        window.setTimeout(() => {
          if (
            wantListeningRef.current &&
            !turnActiveRef.current &&
            !recognitionActiveRef.current &&
            !unmountedRef.current
          ) {
            startRecognitionInternal();
          }
        }, 1200);
      }
    };
    recognition.onend = () => {
      recognitionActiveRef.current = false;
      recognitionRef.current = null;
      if (process.env.NODE_ENV !== "production")
        console.log(
          "[Voice] Recognition ended, wantListening:",
          wantListeningRef.current
        );
      if (
        wantListeningRef.current &&
        !turnActiveRef.current &&
        !unmountedRef.current &&
        stateRef.current === "listening"
      ) {
        if (isMobileDevice()) {
          mobileRestartCountRef.current += 1;
          if (mobileRestartCountRef.current > 12) {
            if (process.env.NODE_ENV !== "production")
              console.log("[Voice] Too many recognition restarts, stopping");
            wantListeningRef.current = false;
            setState("idle");
            setError(
              "Voice recognition stopped unexpectedly. Tap the microphone to try again."
            );
            return;
          }
        }
        const restartDelay = isMobileDevice() ? 400 : 150;
        window.setTimeout(() => {
          if (
            wantListeningRef.current &&
            !turnActiveRef.current &&
            !recognitionActiveRef.current &&
            !unmountedRef.current
          ) {
            startRecognitionInternal();
          }
        }, restartDelay);
      }
    };
    recognition.onstart = () => {
      if (process.env.NODE_ENV !== "production")
        console.log("[Voice] Recognition started");
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      recognitionActiveRef.current = true;
    } catch {
      /* start called while active */
    }
  }

  const normalizeSubtitle = (text: string) =>
    text.replace(/\s+/g, " ").trimStart();

  const revealSubtitleTo = useCallback((globalIndex: number) => {
    lastAdvanceRef.current = Date.now();
    const full = fullReplyRef.current;
    let end = Math.min(
      full.length,
      Math.max(globalIndex, subtitleCharRef.current)
    );
    while (end < full.length && !/\s/.test(full[end])) end += 1;
    if (end <= subtitleCharRef.current) return;
    subtitleCharRef.current = end;
    setSubtitle(normalizeSubtitle(full.slice(0, end)));
  }, []);

  const startSubtitleFallback = useCallback(() => {
    if (subtitleTimerRef.current !== null) return;
    const rate = Math.min(1.6, Math.max(0.7, speechRate));
    const msPerWord = Math.round(380 / rate);
    subtitleTimerRef.current = window.setInterval(() => {
      if (
        boundarySeenRef.current &&
        Date.now() - lastAdvanceRef.current < msPerWord * 2
      )
        return;
      const full = fullReplyRef.current;
      const target = Math.min(full.length, enqueuedLenRef.current);
      if (subtitleCharRef.current >= target) return;
      let next = subtitleCharRef.current;
      while (next < target && /\s/.test(full[next])) next += 1;
      while (next < target && !/\s/.test(full[next])) next += 1;
      if (next <= subtitleCharRef.current) return;
      subtitleCharRef.current = next;
      setSubtitle(normalizeSubtitle(full.slice(0, next)));
    }, msPerWord);
  }, [speechRate]);

  const resolveDrain = useCallback(() => {
    if (speakPendingRef.current <= 0 && !streamOpenRef.current) {
      stopKeepalive();
      clearSubtitles();
      drainResolverRef.current?.();
    }
  }, [clearSubtitles, stopKeepalive]);

  const interruptSpeaking = useCallback(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    }
    activeUtterancesRef.current.clear();
    speakPendingRef.current = 0;
    stopKeepalive();
    clearSubtitles();
    abortRef.current?.abort();
    resolveDrain();
  }, [clearSubtitles, resolveDrain, stopKeepalive]);

  function hardStopInternal() {
    wantListeningRef.current = false;
    captureModeRef.current = "none";
    stopRecognition();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    }
    activeUtterancesRef.current.clear();
    stopKeepalive();
    speakPendingRef.current = 0;
    abortRef.current?.abort();
    streamOpenRef.current = false;
    turnActiveRef.current = false;
    if (turnTimerRef.current) window.clearTimeout(turnTimerRef.current);
    turnTimerRef.current = null;
    releaseMicMeter();
    cancelFallbackRecording(false);
    stopWatchdog();
    clearSubtitles();
    setInterim("");
    interimRef.current = "";
    setFallbackRecording(false);
    setState("idle");
  }

  function scheduleTurn(text: string, attachments?: Array<{fileId: string, name: string, mimeType?: string, url?: string}>) {
    if (turnTimerRef.current) window.clearTimeout(turnTimerRef.current);
    turnTimerRef.current = window.setTimeout(() => {
      turnTimerRef.current = null;
      void handleTurn(text, attachments);
    }, TURN_SILENCE_MS);
  }

  async function ensureConversation() {
    let id = conversationIdRef.current;
    if (!sessionStartedRef.current) {
      sessionStartedRef.current = true;
      const result = await sessionStartMutation.mutateAsync(
        id ? { conversationId: id } : {}
      );
      id = result.conversation.id;
      conversationIdRef.current = id;
      onConversation(id);
    }
    return id;
  }

  function enqueueSentence(rawSentence: string, startOffset: number) {
    if (!("speechSynthesis" in window)) return;
    // Clean text to natural spoken English without markdown clutter or emojis
    const sentence = cleanTextForSpeech(rawSentence);
    if (!sentence) return;

    // Dynamically query voices if not picked yet
    if (!voiceRef.current) {
      const allVoices = window.speechSynthesis.getVoices();
      if (allVoices.length) {
        voiceRef.current = selectBestHumanVoice(allVoices, preferredVoiceNameRef.current);
      }
    }

    const lead = rawSentence.length - rawSentence.trimStart().length;
    const utterance = new SpeechSynthesisUtterance(sentence);
    // Natural human cadence
    utterance.rate = Math.min(1.3, Math.max(0.85, speechRate));
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    if (voiceRef.current) utterance.voice = voiceRef.current;

    // Retain reference in set to prevent Chromium garbage collection speech-drop bug
    activeUtterancesRef.current.add(utterance);
    speakPendingRef.current += 1;

    utterance.onstart = () => {
      lastSpeakStartRef.current = Date.now();
      if (stateRef.current !== "speaking") setState("speaking");
      startKeepalive();
      startSubtitleFallback();
    };
    utterance.onboundary = event => {
      if (!boundarySeenRef.current) {
        boundarySeenRef.current = true;
        stopSubtitleTimer();
      }
      revealSubtitleTo(startOffset + lead + event.charIndex);
    };
    const settle = () => {
      activeUtterancesRef.current.delete(utterance);
      speakPendingRef.current = Math.max(0, speakPendingRef.current - 1);
      resolveDrain();
    };
    utterance.onend = settle;
    utterance.onerror = (event) => {
      activeUtterancesRef.current.delete(utterance);
      console.warn('[Voice] Speech synthesis error:', event.error);
      settle();
    };

    // Unpause in case browser paused speech synthesis
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    window.speechSynthesis.speak(utterance);
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }

  function flushSpokenChunks(force: boolean) {
    const full = fullReplyRef.current;
    const MAX_CHUNK = 350;
    while (enqueuedLenRef.current < full.length) {
      const segment = full.slice(enqueuedLenRef.current);
      let cut = -1;

      if (segment.length < MAX_CHUNK && !force) break;

      const nlIndex = segment.indexOf("\n");
      if (nlIndex !== -1 && nlIndex < MAX_CHUNK) {
        cut = nlIndex + 1;
      }

      if (cut === -1) {
        let lastSentenceCut = -1;
        for (
          let index = 0;
          index < Math.min(segment.length, MAX_CHUNK);
          index += 1
        ) {
          const char = segment[index];
          if (
            char === "." ||
            char === "!" ||
            char === "?" ||
            char === "…" ||
            char === "。" ||
            char === "！" ||
            char === "？"
          ) {
            let end = index + 1;
            while (end < segment.length && ")\"']".includes(segment[end])) end += 1;
            if (end >= segment.length || /\s/.test(segment[end])) {
              lastSentenceCut = end;
            }
          }
        }
        if (lastSentenceCut > 0) cut = lastSentenceCut;
      }

      if (cut === -1 && segment.length > MAX_CHUNK) {
        for (
          let index = Math.min(segment.length, MAX_CHUNK + 20);
          index > 30;
          index -= 1
        ) {
          if (/\s/.test(segment[index])) {
            cut = index + 1;
            break;
          }
        }
      }

      if (cut === -1) {
        if (!force) break;
        cut = segment.length;
      }

      const chunk = segment.slice(0, cut);
      if (chunk.trim()) enqueueSentence(chunk, enqueuedLenRef.current);
      enqueuedLenRef.current += cut;
    }
  }

  async function waitForSpeechDrained() {
    if (speakPendingRef.current <= 0 && !streamOpenRef.current) return;
    await new Promise<void>(resolve => {
      drainResolverRef.current = resolve;
    });
    drainResolverRef.current = null;
  }

  async function handleTurn(userText: string, attachments?: Array<{fileId: string, name: string, mimeType?: string, url?: string}>) {
    if (turnActiveRef.current || unmountedRef.current || !userText.trim())
      return;
    turnActiveRef.current = true;
    setError(null);
    clearSubtitles();
    fullReplyRef.current = "";
    stopRecognition();
    setState("processing");

    const controller = new AbortController();
    abortRef.current = controller;
    let responseText = "";
    let serverError: string | null = null;

    // Same contract as the text workspace: a silent or overlong stream is
    // aborted instead of leaving the turn stuck in "processing" forever.
    const startedAt = Date.now();
    let lastActivityAt = startedAt;
    const watchdog = window.setInterval(() => {
      const now = Date.now();
      if (
        now - lastActivityAt > 45_000 ||
        now - startedAt > 300_000
      ) {
        controller.abort();
      }
    }, 1_000);

    try {
      const activeConversationId = await ensureConversation();
      const requestBody: Record<string, unknown> = {
        conversationId: activeConversationId,
        content: userText,
        mode: "voice",
        timeZone: currentTimeZone(),
      };
      
      // Add attachments if provided
      if (attachments && attachments.length > 0) {
        console.log('[VoiceSession] Sending attachments:', attachments);
        requestBody.attachments = attachments.map(file => ({
          id: file.fileId,
          filename: file.name,
          mimeType: file.mimeType,
          url: file.url,
        }));
      } else {
        console.log('[VoiceSession] No attachments to send');
      }
      
      console.log('[VoiceSession] Request body:', JSON.stringify(requestBody, null, 2));
      
      const authHeaders = getAuthHeaders();
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        credentials: "include",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream",
          ...authHeaders,
        },
        body: JSON.stringify(requestBody),
      });
      lastActivityAt = Date.now();
      if (!response.ok || !response.body) {
        let serverError = "";
        try {
          const errData = await response.json();
          serverError = errData?.error || "";
        } catch {}
        throw new Error(serverError || "The response stream could not be started.");
      }

      streamOpenRef.current = true;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        lastActivityAt = Date.now();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const rawEvent of events) {
          const eventName = rawEvent
            .split("\n")
            .find(line => line.startsWith("event:"))
            ?.slice(6)
            .trim();
          const rawData = rawEvent
            .split("\n")
            .find(line => line.startsWith("data:"))
            ?.slice(5)
            .trim();
          if (!eventName || !rawData) continue;
          let data: Record<string, string>;
          try {
            data = JSON.parse(rawData) as Record<string, string>;
          } catch {
            continue;
          }
          if (eventName === "assistant.delta") {
            responseText += data.delta;
            fullReplyRef.current = responseText;
            flushSpokenChunks(false);
          }
          if (eventName === "assistant.error")
            serverError =
              data.message || "KSEMO could not complete this response.";
        }
      }
      streamOpenRef.current = false;
      flushSpokenChunks(true);
      if (!responseText.trim()) {
        if (serverError) setError(serverError);
        else
          setError(
            "KSEMO heard you, but the reply came back empty. Please try asking again."
          );
        console.warn("[KSEMO Voice] Empty assistant stream for:", userText);
      }
      await waitForSpeechDrained();
    } catch (caught) {
      streamOpenRef.current = false;
      if ((caught as Error).name !== "AbortError") {
        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
        speakPendingRef.current = 0;
        setError(
          serverError ??
            "KSEMO could not complete that response. Tap the microphone and try again."
        );
      }
    } finally {
      clearInterval(watchdog);
      abortRef.current = null;
      clearSubtitles();
      finishTurn();
    }
  }

  function handleFallbackTranscript(text: string) {
    if (!text.trim()) {
      setError(
        "No speech was detected. Try speaking a little closer to the microphone."
      );
      return;
    }
    void handleTurn(text.trim());
  }

  function cancelFallbackRecording(clearChunks: boolean) {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (clearChunks) recorderChunksRef.current = [];
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        /* already stopped */
      }
    }
    releaseMicMeter();
    setFallbackRecording(false);
  }

  const startListening = useCallback(async () => {
    if (stateRef.current !== "idle" || unmountedRef.current) return;
    setError(null);
    if (isMobileDevice() && getRecognitionCtor()) {
      if (process.env.NODE_ENV !== "production")
        console.log(
          "[Voice] Mobile path: SpeechRecognition only (no getUserMedia)"
        );
      wantListeningRef.current = true;
      captureModeRef.current = "recognition";
      lastVoiceEventRef.current = Date.now();
      setState("listening");
      setInterim("");
      interimRef.current = "";
      mobileRestartCountRef.current = 0;
      startWatchdog();
      startRecognitionInternal();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "Voice input is not supported in this browser. Use a current desktop or mobile browser with microphone support."
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioCtx();
      if (audioContext.state === "suspended") {
        void audioContext.resume();
      }
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;
      const samples = new Uint8Array(analyser.fftSize);
      const freqBins = new Uint8Array(analyser.frequencyBinCount);
      let smoothed = 0;
      const tick = () => {
        const currentAnalyser = analyserRef.current;
        if (!currentAnalyser) return;
        currentAnalyser.getByteTimeDomainData(samples);
        currentAnalyser.getByteFrequencyData(freqBins);
        let sumSquares = 0;
        for (let index = 0; index < samples.length; index += 1) {
          const centered = (samples[index] - 128) / 128;
          sumSquares += centered * centered;
        }
        const rms = Math.sqrt(sumSquares / samples.length);
        smoothed += (Math.min(1, rms * 3.2) - smoothed) * 0.25;
        levelRef.current = smoothed;
        const out = freqDataRef.current;
        const step = Math.max(1, Math.floor(freqBins.length / out.length));
        for (let i = 0; i < out.length; i++) {
          out[i] = freqBins[i * step] ?? 0;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      wantListeningRef.current = true;
      captureModeRef.current = "recognition";
      lastVoiceEventRef.current = Date.now();
      setState("listening");
      setInterim("");
      interimRef.current = "";
      startWatchdog();
      if (getRecognitionCtor()) startRecognitionInternal();
    } catch (caught) {
      releaseMicMeter();
      wantListeningRef.current = false;
      stopWatchdog();
      setState("idle");
      if ((caught as DOMException).name === "NotAllowedError")
        setError(
          "Microphone access is blocked. Allow microphone access for KSEMO in your browser settings, then try again."
        );
      else
        setError(
          "KSEMO could not access a microphone. Check that a microphone is connected and available."
        );
    }
  }, [releaseMicMeter, startWatchdog, stopWatchdog]);

  const stopListening = useCallback(() => {
    wantListeningRef.current = false;
    captureModeRef.current = "none";
    stopRecognition();
    releaseMicMeter();
    stopWatchdog();
    setInterim("");
    interimRef.current = "";
    setState("idle");
  }, [releaseMicMeter, stopRecognition, stopWatchdog]);

  const startPushToTalk = useCallback(async () => {
    if (stateRef.current !== "idle" || fallbackRecording) return;
    setError(null);
    captureModeRef.current = "capture";
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Voice input is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;
      const samples = new Uint8Array(analyser.fftSize);
      let smoothed = 0;
      let heardSpeech = false;
      let spokeAt = 0;
      const startedAt = Date.now();
      const tick = () => {
        const currentAnalyser = analyserRef.current;
        if (!currentAnalyser) return;
        currentAnalyser.getByteTimeDomainData(samples);
        let sumSquares = 0;
        for (let index = 0; index < samples.length; index += 1)
          sumSquares += Math.pow((samples[index] - 128) / 128, 2);
        smoothed +=
          (Math.min(1, Math.sqrt(sumSquares / samples.length) * 3.2) -
            smoothed) *
          0.25;
        levelRef.current = smoothed;
        if (smoothed > 0.08) {
          heardSpeech = true;
          spokeAt = Date.now();
        }
        if (
          heardSpeech &&
          Date.now() - startedAt > TURN_SILENCE_MS + 350 &&
          Date.now() - spokeAt > 1500
        ) {
          const activeRecorder = recorderRef.current;
          if (activeRecorder && activeRecorder.state === "recording") {
            activeRecorder.stop();
            return;
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      recorderChunksRef.current = [];
      const mimeType = chooseRecorderType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = event => {
        if (event.data.size) recorderChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        releaseMicMeter();
        const audioType = (recorder.mimeType || mimeType || "audio/webm").split(
          ";"
        )[0];
        const recording = new Blob(recorderChunksRef.current, {
          type: audioType,
        });
        recorderChunksRef.current = [];
        if (!recording.size) {
          setError(
            "No audio was captured. Check your microphone and try again."
          );
          return;
        }
        if (recording.size > 12 * 1024 * 1024) {
          setError(
            "That recording is too large. Keep each push-to-talk message short."
          );
          return;
        }
        setState("processing");
        try {
          const result = await transcribeMutation.mutateAsync({
            audioBase64: await toBase64(recording),
            mimeType: audioType,
          });
          handleFallbackTranscript(result.text);
        } catch (mutationError) {
          setState("idle");
          setError(
            (mutationError as Error).message ||
              "KSEMO could not transcribe that recording."
          );
        }
      };
      recorder.start(250);
      setFallbackRecording(true);
      setState("listening");
    } catch (caught) {
      releaseMicMeter();
      if ((caught as DOMException).name === "NotAllowedError")
        setError(
          "Microphone access is blocked. Allow microphone access for KSEMO in your browser settings, then try again."
        );
      else
        setError(
          "KSEMO could not access a microphone. Check that a microphone is connected and available."
        );
    }
  }, [fallbackRecording, releaseMicMeter, transcribeMutation]);

  const stopPushToTalk = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
    setFallbackRecording(false);
  }, []);

  const toggleMic = useCallback(() => {
    switch (stateRef.current) {
      case "idle":
        if (continuousSupported) void startListening();
        else void startPushToTalk();
        break;
      case "listening":
        if (fallbackRecording) stopPushToTalk();
        else stopListening();
        break;
      case "processing":
      case "speaking":
        hardStopInternal();
        break;
    }
  }, [
    continuousSupported,
    fallbackRecording,
    startListening,
    startPushToTalk,
    stopListening,
    stopPushToTalk,
  ]);

  const setMuted = useCallback(
    (muted: boolean) => {
      if (!muted) {
        if (continuousSupported) void startListening();
        else void startPushToTalk();
        return;
      }
      wantListeningRef.current = false;
      stopWatchdog();
      setInterim("");
      interimRef.current = "";
      if (fallbackRecording) {
        cancelFallbackRecording(true);
      } else {
        stopListening();
      }
      setState("idle");
    },
    [
      continuousSupported,
      fallbackRecording,
      startListening,
      startPushToTalk,
      stopListening,
      stopWatchdog,
    ]
  );

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      hardStopInternal();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isMobileDevice()) return;
    const handleVisibility = () => {
      if (document.hidden && stateRef.current !== "idle") {
        if (process.env.NODE_ENV !== "production")
          console.log("[Voice] Page hidden, cleaning up voice session");
        wantListeningRef.current = false;
        stopRecognition();
        stopWatchdog();
        setInterim("");
        interimRef.current = "";
        setState("idle");
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [stopRecognition, stopWatchdog]);

  function sendText(text: string, attachments?: Array<{fileId: string, name: string, mimeType?: string, url?: string}>) {
    const trimmed = text.trim();
    if (unmountedRef.current || !trimmed) return;
    if (turnActiveRef.current) {
      interruptSpeaking();
      scheduleTurn(trimmed, attachments);
      return;
    }
    void handleTurn(trimmed, attachments);
  }

  return {
    state,
    interim,
    subtitle,
    error,
    clearError: () => setError(null),
    levelRef,
    freqDataRef,
    continuousSupported,
    fallbackRecording,
    voices: voiceList,
    selectedVoiceName,
    setVoiceName,
    sendText,
    startListening,
    stopListening,
    startPushToTalk,
    stopPushToTalk,
    toggleMic,
    setMuted,
    exitAndCleanup: hardStopInternal,
  };
}