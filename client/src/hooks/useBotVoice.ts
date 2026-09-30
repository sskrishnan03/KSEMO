import { trpc } from "@/lib/trpc";
import {
  playBotVoiceCancel,
  playBotVoiceStart,
  playBotVoiceStop,
} from "@/lib/recordingSounds";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Bot mode's voice. You speak, words appear live in the
 * chat box as you talk, and once you stop talking for SILENCE_MS the transcript
 * sends itself and the reply streams back — so Bot behaves like a phone call
 * without ever leaving the composer.
 *
 * Uses the browser's SpeechRecognition where available, because that is the
 * only thing that produces text incrementally. Everywhere else (Firefox, and
 * Safari's older shapes) it degrades to MediaRecorder plus the server
 * transcribe endpoint, which can only speak after the fact.
 */

export type BotVoiceState = "idle" | "listening" | "transcribing";

/** How long a pause counts as "I've finished talking". */
const SILENCE_MS = 600;
const FINAL_SILENCE_MS = 350;

/** Above this the mic is considered open, which drives the wave. */
const LISTENING_LEVEL_THRESHOLD = 0.02;

/** Bar count for the wave. Kept coarse so each frame stays cheap. */
export const WAVE_BAR_COUNT = 40;

/** The DOM lib does not ship the Web Speech API, so these are declared here
    rather than pulled from a typings package. Only the surface this hook uses. */
type SpeechAlternative = { transcript?: string };
type SpeechResult = { isFinal?: boolean; 0?: SpeechAlternative };
type SpeechEvent = {
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
};
type SpeechErrorEvent = { error?: string };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function chooseRecorderType() {
  if (typeof MediaRecorder === "undefined") return undefined;
  return [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ].find(type => MediaRecorder.isTypeSupported(type));
}

async function toBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(offset, offset + chunk) as unknown as number[]
    );
  }
  return window.btoa(binary);
}

export function useBotVoice({
  /** Called every time the draft in the composer should change. */
  onDraft,
  /** Called with the finished transcript once the user has stopped talking. */
  onSend,
  /** Reads whatever is already in the composer so a voice turn never erases
      text the user typed beforehand. */
  getCurrentText,
  onError,
}: {
  onDraft: (text: string) => void;
  onSend: (text: string) => void;
  getCurrentText?: () => string;
  onError?: (message: string) => void;
}) {
  const [state, setState] = useState<BotVoiceState>("idle");
  const [micDenied, setMicDenied] = useState(false);

  const transcribe = trpc.voice.transcribe.useMutation();

  const stateRef = useRef<BotVoiceState>("idle");
  const setStateBoth = useCallback((next: BotVoiceState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  /** Live spectrum for the wave. Written in place; never triggers a render. */
  const barsRef = useRef<number[]>(new Array<number>(WAVE_BAR_COUNT).fill(0));
  const levelRef = useRef(0);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wantListeningRef = useRef(false);
  const unmountedRef = useRef(false);
  const pausedRef = useRef(false);

  /** Everything recognised in this turn, final segments only. */
  const committedRef = useRef("");
  /** The composer text as it was before listening started. */
  const baseRef = useRef("");
  const silenceTimerRef = useRef<number | null>(null);

  // --- waveform metering -------------------------------------------------
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  // --- MediaRecorder fallback -------------------------------------------
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const publishDraft = useCallback(() => {
    if (pausedRef.current) return;
    const interim = interimRef.current;
    const draft = [baseRef.current, committedRef.current, interim]
      .filter(part => part && part.length)
      .join(" ")
      .replace(/\s+/g, " ")
      .trimStart();
    onDraft(draft);
  }, [onDraft]);

  const interimRef = useRef("");

  /** Hands the finished turn to the bot and resets for the next one. */
  const finishTurn = useCallback(() => {
    clearSilenceTimer();
    const spoken = [
      baseRef.current.trim(),
      committedRef.current.trim(),
      interimRef.current.trim(),
    ]
      .filter(Boolean)
      .join(" ")
      .trim();
    interimRef.current = "";
    committedRef.current = "";
    baseRef.current = "";
    if (spoken) {
      pausedRef.current = true;
      onSend(spoken);
    } else {
      onDraft("");
    }
  }, [clearSilenceTimer, onDraft, onSend]);

  /** Every new word pushes the auto-send further out. */
  const armSilenceTimer = useCallback(
    (delay = SILENCE_MS) => {
      if (pausedRef.current) return;
      clearSilenceTimer();
      silenceTimerRef.current = window.setTimeout(() => {
        silenceTimerRef.current = null;
        const spoken = [
          committedRef.current.trim(),
          interimRef.current.trim(),
        ]
          .filter(Boolean)
          .join(" ")
          .trim();
        // Auto-send once user stops speaking
        if (spoken && !pausedRef.current) finishTurn();
      }, delay);
    },
    [clearSilenceTimer, finishTurn]
  );

  // --- audio metering ----------------------------------------------------
  const startMetering = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (unmountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      audioContextRef.current = ctx;
      if (ctx.state === "suspended") void ctx.resume();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      ctx.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;

      const freqBins = new Uint8Array(analyser.frequencyBinCount);
      const out = barsRef.current;
      // Log-ish spacing: low frequencies carry most speech energy, and a linear
      // split leaves the right-hand bars almost permanently flat.
      const ratios = out.map((_, index) =>
        Math.pow((index + 1) / out.length, 1.6)
      );

      const tick = () => {
        if (unmountedRef.current || !analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(freqBins);
        let sum = 0;
        for (let index = 0; index < freqBins.length; index += 1) {
          sum += freqBins[index];
        }
        levelRef.current = Math.min(1, (sum / (freqBins.length * 255)) * 2.4);

        for (let index = 0; index < out.length; index += 1) {
          const bin = Math.min(
            freqBins.length - 1,
            Math.floor(ratios[index] * freqBins.length)
          );
          const raw = (freqBins[bin] ?? 0) / 255;
          // A floor keeps the row visible as a line at true silence, so it reads
          // as a wave at rest instead of vanishing.
          const target =
            levelRef.current < LISTENING_LEVEL_THRESHOLD
              ? 0.06
              : Math.max(0.1, Math.min(1, raw * 1.9));
          // Ease toward the target so bars glide instead of strobing.
          out[index] += (target - out[index]) * 0.3;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setMicDenied(true);
      onError?.("Microphone unavailable.");
    }
  }, [onError]);

  const stopMetering = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    levelRef.current = 0;
    barsRef.current.fill(0.06);
  }, []);

  // --- recognition -------------------------------------------------------
  const startRecognition = useCallback(() => {
    const Recognition = getRecognitionCtor();
    if (!Recognition) return false;
    const recognition = new Recognition();
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = event => {
      if (pausedRef.current) return;
      let interim = "";
      let hasFinal = false;
      for (
        let index = event.resultIndex;
        index < event.results.length;
        index++
      ) {
        const result = event.results[index];
        if (!result) continue;
        const text = (result[0]?.transcript ?? "").trim();
        if (!text) continue;
        if (result.isFinal) {
          committedRef.current = joinText(committedRef.current, text);
          hasFinal = true;
        } else {
          interim = joinText(interim, text);
        }
      }
      if (pausedRef.current) return;
      interimRef.current = interim;
      publishDraft();
      armSilenceTimer(hasFinal ? FINAL_SILENCE_MS : SILENCE_MS);
    };

    // Browsers stop recognition on their own every so often; restart it so a
    // long answer doesn't get cut off mid-sentence.
    recognition.onend = () => {
      if (wantListeningRef.current && !unmountedRef.current) {
        try {
          recognition.start();
        } catch {
          wantListeningRef.current = false;
        }
      }
    };

    recognition.onerror = event => {
      if (event.error === "not-allowed" || event.error === "audio-capture") {
        wantListeningRef.current = false;
        setMicDenied(true);
        onError?.("Microphone permission was denied.");
      }
      // `no-speech` and `aborted` are routine; nothing to report.
    };

    try {
      recognition.start();
    } catch {
      return false;
    }
    recognitionRef.current = recognition;
    return true;
  }, [armSilenceTimer, onError, publishDraft]);

  const stopRecognition = useCallback(() => {
    wantListeningRef.current = false;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (!recognition) return;
    recognition.onend = null;
    try {
      recognition.stop();
    } catch {
      // Already stopped.
    }
  }, []);

  // --- MediaRecorder fallback -------------------------------------------
  // Only reached where SpeechRecognition is missing (Firefox, older Safari).
  // There is no interim text to show, so the wave runs off the same analyser and
  // the transcript only lands once recording has stopped.
  const startRecordingFallback = useCallback(async () => {
    const mimeType = chooseRecorderType();
    let recorder: MediaRecorder;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (unmountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return false;
      }
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      setMicDenied(true);
      onError?.("Microphone permission was denied.");
      return false;
    }

    chunksRef.current = [];
    recorder.ondataavailable = event => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const audioType = (recorder.mimeType || mimeType || "audio/webm").split(
        ";"
      )[0];
      const blob = new Blob(chunksRef.current, { type: audioType });
      chunksRef.current = [];
      recorderRef.current = null;
      stopMetering();
      if (!blob.size) {
        setStateBoth("idle");
        onError?.(
          "No audio was captured. Check your microphone and try again."
        );
        return;
      }
      if (blob.size > 20 * 1024 * 1024) {
        setStateBoth("idle");
        onError?.("That recording is too long to transcribe.");
        return;
      }
      setStateBoth("transcribing");
      void toBase64(blob)
        .then(audioBase64 =>
          transcribe.mutateAsync({ audioBase64, mimeType: audioType })
        )
        .then(result => {
          const said = result.text.trim();
          const base = baseRef.current.trim();
          const spoken = [base, said].filter(Boolean).join(" ").trim();
          baseRef.current = "";
          setStateBoth("idle");
          if (spoken) {
            onDraft(spoken);
            onSend(spoken);
          } else {
            onError?.("No speech was detected. Please try again.");
          }
        })
        .catch(() => {
          setStateBoth("idle");
          onError?.("KSEMO could not transcribe that recording.");
        });
    };
    recorder.start(250);
    recorderRef.current = recorder;
    return true;
  }, [onDraft, onError, onSend, setStateBoth, stopMetering, transcribe]);

  const stopRecordingFallback = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    try {
      recorder.stop();
    } catch {
      recorderRef.current = null;
      setStateBoth("idle");
    }
  }, [setStateBoth]);

  // --- public api --------------------------------------------------------
  const pauseListening = useCallback(() => {
    pausedRef.current = true;
    clearSilenceTimer();
    interimRef.current = "";
    committedRef.current = "";
  }, [clearSilenceTimer]);

  const resumeListening = useCallback(() => {
    pausedRef.current = false;
    committedRef.current = "";
    interimRef.current = "";
    baseRef.current = "";
    clearSilenceTimer();
    if (wantListeningRef.current && !unmountedRef.current && !recognitionRef.current) {
      startRecognition();
    }
  }, [clearSilenceTimer, startRecognition]);

  const start = useCallback(async () => {
    if (stateRef.current !== "idle") return;
    pausedRef.current = false;
    committedRef.current = "";
    interimRef.current = "";
    // Preserve whatever was already in the composer so a voice turn extends it
    // instead of wiping it.
    baseRef.current = getCurrentText?.() ?? "";
    setMicDenied(false);
    setStateBoth("listening");
    playBotVoiceStart();

    await startMetering();

    if (startRecognition()) {
      wantListeningRef.current = true;
      return;
    }

    // No SpeechRecognition — record, then transcribe when stopped.
    const started = await startRecordingFallback();
    if (!started) {
      stopMetering();
      setStateBoth("idle");
      onError?.("Voice input is not supported in this browser.");
      return;
    }
    wantListeningRef.current = true;
  }, [
    getCurrentText,
    onError,
    setStateBoth,
    startMetering,
    startRecordingFallback,
    startRecognition,
  ]);

  const stop = useCallback(() => {
    if (stateRef.current === "idle") return;
    pausedRef.current = false;
    playBotVoiceStop();
    if (recorderRef.current) {
      stopRecordingFallback();
      return;
    }
    stopRecognition();
    stopMetering();
    setStateBoth("idle");
    // Anything already recognised counts as a finished answer.
    finishTurn();
  }, [
    finishTurn,
    setStateBoth,
    stopMetering,
    stopRecordingFallback,
    stopRecognition,
  ]);

  const cancel = useCallback(() => {
    pausedRef.current = false;
    clearSilenceTimer();
    committedRef.current = "";
    interimRef.current = "";
    baseRef.current = "";
    onDraft("");
    playBotVoiceCancel();
    if (recorderRef.current) {
      // Drop the in-flight recorder so its onstop cannot send a discarded turn.
      recorderRef.current.onstop = null;
      try {
        recorderRef.current.stop();
      } catch {
        // Already stopped.
      }
      recorderRef.current = null;
    }
    stopRecognition();
    stopMetering();
    setStateBoth("idle");
  }, [clearSilenceTimer, onDraft, setStateBoth, stopMetering, stopRecognition]);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      clearSilenceTimer();
      stopRecognition();
      stopMetering();
      if (recorderRef.current) {
        recorderRef.current.onstop = null;
        chunksRef.current = [];
        try {
          recorderRef.current.stop();
        } catch {
          // Already stopped.
        }
        recorderRef.current = null;
      }
    };
  }, [clearSilenceTimer, stopMetering, stopRecognition]);

  return {
    state,
    micDenied,
    /** Live spectrum for the wave. Mutated in place each frame. */
    barsRef,
    levelRef,
    continuousSupported: getRecognitionCtor() !== null,
    pauseListening,
    resumeListening,
    start,
    stop,
    cancel,
  };
}

/** Joins transcript fragments with a single space, no doubling or leading gap. */
function joinText(existing: string, addition: string) {
  if (!existing) return addition;
  if (!addition) return existing;
  return `${existing.replace(/\s+$/, "")} ${addition}`;
}
