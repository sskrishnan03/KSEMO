/**
 * Speech Reactive Controller
 * Coordinates real-time speech synthesis events (onstart, onboundary, onend)
 * with dynamic acoustic energy modeling, so the Read Aloud wave visualizer reacts
 * authentically to the actual voice cadence, words, syllables, and punctuation pauses
 * rather than running a canned looping animation.
 */

import { useEffect, useState } from "react";

export type SpeechVisualizerState = "idle" | "buffering" | "playing" | "paused";

export interface SpeechWordData {
  text: string;
  start: number;
  end: number;
  syllables: number;
  pauseAfterMs: number;
  energy: number;
}

/**
 * Parses cleaned text into individual spoken words with estimated syllables,
 * acoustic energy weight, and natural punctuation pause durations.
 */
export function parseSpeechWords(text: string): SpeechWordData[] {
  const words: SpeechWordData[] = [];
  const regex = /\S+/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const rawWord = match[0];
    const letters = rawWord.toLowerCase().replace(/[^a-z]/g, "");

    // Approximate syllables by vowel clusters
    const vowelMatches = letters.match(/[aeiouy]+/g);
    const syllables = Math.max(
      1,
      Math.min(5, vowelMatches ? vowelMatches.length : 1)
    );

    // Natural breathing / punctuation pauses
    let pauseAfterMs = 40; // normal inter-word gap
    if (/[,\-;:]$/.test(rawWord)) {
      pauseAfterMs = 220; // comma / semicolon pause
    } else if (/[.!?]$/.test(rawWord)) {
      pauseAfterMs = 380; // sentence end pause
    }

    // Energy based on vowel weight and word length
    const energy = Math.min(
      1.0,
      0.45 + syllables * 0.12 + (letters.length > 5 ? 0.15 : 0)
    );

    words.push({
      text: rawWord,
      start: match.index,
      end: match.index + rawWord.length,
      syllables,
      pauseAfterMs,
      energy,
    });
  }

  return words;
}

type HeightsListener = (heights: [number, number, number, number]) => void;

class SpeechReactiveService {
  private activeMessageId: string | null = null;
  private state: SpeechVisualizerState = "idle";
  private words: SpeechWordData[] = [];
  private currentWordIndex: number = 0;
  private animFrameId: number | null = null;
  private wordDecayTimerId: number | null = null;
  private wordProgressTimerId: number | null = null;
  private hasNativeWordBoundaries = false;

  // Real-time acoustic energy envelope
  private currentEnergy: number = 0; // 0 to 1
  private targetEnergy: number = 0;
  private barMultipliers: [number, number, number, number] = [
    0.75, 1.0, 0.85, 0.65,
  ];
  private currentHeights: [number, number, number, number] = [3, 3, 3, 3];

  private listeners = new Set<HeightsListener>();

  public getActiveMessageId(): string | null {
    return this.activeMessageId;
  }

  public getState(): SpeechVisualizerState {
    return this.state;
  }

  public subscribe(listener: HeightsListener): () => void {
    this.listeners.add(listener);
    // Send initial heights
    listener(this.currentHeights);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.currentHeights);
    }
  }

  /**
   * Bind an utterance to the speech visualizer.
   * Starts in "buffering" so bars stay at resting level until audio starts.
   */
  public bindUtterance(
    utterance: SpeechSynthesisUtterance,
    messageId: string,
    cleanText: string,
    callbacks?: {
      onStart?: () => void;
      onEnd?: () => void;
      onError?: () => void;
      onPause?: () => void;
      onResume?: () => void;
    }
  ) {
    this.stop(); // Clear any existing speech tracking
    this.activeMessageId = messageId;
    this.state = "buffering";
    this.words = parseSpeechWords(cleanText);
    this.currentWordIndex = 0;
    this.hasNativeWordBoundaries = false;
    this.currentEnergy = 0;
    this.targetEnergy = 0;
    this.currentHeights = [3, 3, 3, 3];
    this.notify();

    const originalOnStart = utterance.onstart;
    const originalOnBoundary = utterance.onboundary;
    const originalOnEnd = utterance.onend;
    const originalOnError = utterance.onerror;
    const originalOnPause = utterance.onpause;
    const originalOnResume = utterance.onresume;

    utterance.onstart = e => {
      if (this.activeMessageId === messageId) {
        this.state = "playing";
        this.startLoop();
        // Speech has actually begun, so use the first spoken word to wake the
        // waveform immediately while subsequent word events keep it in sync.
        const firstWord = this.words[0];
        if (firstWord) {
          this.currentWordIndex = 1;
          this.triggerWord(firstWord);
          this.scheduleWordProgress(utterance.rate || 1);
        }
      }
      originalOnStart?.call(utterance, e);
      callbacks?.onStart?.();
    };

    utterance.onboundary = e => {
      if (
        this.activeMessageId === messageId &&
        (e.name === "word" || e.name === "sentence" || !e.name)
      ) {
        this.hasNativeWordBoundaries = true;
        if (this.wordProgressTimerId !== null) {
          window.clearTimeout(this.wordProgressTimerId);
          this.wordProgressTimerId = null;
        }
        const charIdx = e.charIndex;
        // Find matching word
        let matchedIndex = this.words.findIndex(
          word => word.start <= charIdx && charIdx <= word.end
        );
        if (matchedIndex < 0) matchedIndex = this.currentWordIndex;
        const matched = this.words[matchedIndex];
        if (matched) {
          this.currentWordIndex = matchedIndex + 1;
          this.triggerWord(matched);
        }
      }
      originalOnBoundary?.call(utterance, e);
    };

    utterance.onpause = e => {
      if (this.activeMessageId === messageId) {
        this.state = "paused";
        this.targetEnergy = 0;
        if (this.wordProgressTimerId !== null) {
          window.clearTimeout(this.wordProgressTimerId);
          this.wordProgressTimerId = null;
        }
      }
      originalOnPause?.call(utterance, e);
      callbacks?.onPause?.();
    };

    utterance.onresume = e => {
      if (this.activeMessageId === messageId) {
        this.state = "playing";
        this.scheduleWordProgress(utterance.rate || 1);
      }
      originalOnResume?.call(utterance, e);
      callbacks?.onResume?.();
    };

    utterance.onend = e => {
      if (this.activeMessageId === messageId) {
        this.stop();
      }
      originalOnEnd?.call(utterance, e);
      callbacks?.onEnd?.();
    };

    utterance.onerror = e => {
      if (this.activeMessageId === messageId) {
        this.stop();
      }
      originalOnError?.call(utterance, e);
      callbacks?.onError?.();
    };
  }

  private triggerWord(word: SpeechWordData) {
    const lengthRatio = Math.min(word.text.length / 10, 1);
    const syllableRatio = Math.min(word.syllables / 4, 1);
    this.barMultipliers = [
      0.55 + lengthRatio * 0.2,
      0.65 + syllableRatio * 0.3,
      0.55 + lengthRatio * 0.3,
      0.45 + syllableRatio * 0.35,
    ];

    // Each update is driven by the word that the speech engine reports.
    this.targetEnergy = word.energy;

    // Schedule decay for the word reported by the speech engine.
    if (this.wordDecayTimerId !== null) {
      window.clearTimeout(this.wordDecayTimerId);
    }

    const wordDuration = Math.max(120, word.syllables * 130);
    this.wordDecayTimerId = window.setTimeout(() => {
      if (this.state === "playing") {
        // Natural drop during pause between words / punctuation
        this.targetEnergy = 0.05;
      }
    }, wordDuration);
  }

  /**
   * SpeechSynthesis boundary events are optional. When a voice omits them,
   * advance through the response's real words once at its selected speech
   * rate. Native boundary events cancel this estimate and take over.
   */
  private scheduleWordProgress(rate: number) {
    if (
      this.hasNativeWordBoundaries ||
      this.state !== "playing" ||
      this.currentWordIndex >= this.words.length
    ) {
      return;
    }
    const previousWord = this.words[this.currentWordIndex - 1];
    if (!previousWord) return;
    const delay = Math.max(
      180,
      Math.round(
        (previousWord.syllables * 190 + previousWord.pauseAfterMs) / rate
      )
    );
    this.wordProgressTimerId = window.setTimeout(() => {
      this.wordProgressTimerId = null;
      if (this.hasNativeWordBoundaries || this.state !== "playing") return;
      const word = this.words[this.currentWordIndex];
      if (!word) return;
      this.currentWordIndex += 1;
      this.triggerWord(word);
      this.scheduleWordProgress(rate);
    }, delay);
  }

  private startLoop() {
    if (this.animFrameId !== null) return;

    const tick = () => {
      if (this.state !== "playing") {
        // Smoothly settle down to resting 3px
        let changed = false;
        for (let i = 0; i < 4; i++) {
          if (this.currentHeights[i] > 3.1) {
            this.currentHeights[i] += (3 - this.currentHeights[i]) * 0.2;
            changed = true;
          } else {
            this.currentHeights[i] = 3;
          }
        }
        if (changed) this.notify();
        if (this.state === "idle") {
          this.animFrameId = null;
          return;
        }
      } else {
        // Smooth acoustic envelope interpolation
        const attackRate = 0.35; // Fast attack for crisp syllables
        const decayRate = 0.15; // Smooth natural vocal decay
        const rate =
          this.targetEnergy > this.currentEnergy ? attackRate : decayRate;
        this.currentEnergy += (this.targetEnergy - this.currentEnergy) * rate;

        // Envelope changes come from actual word boundaries; interpolation only
        // smooths each word's attack and decay instead of inventing a loop.
        const baseLevel = Math.max(0, Math.min(1, this.currentEnergy));

        // Map to bar heights: 3px (resting) to 15px (peak volume)
        const minH = 3;
        const maxH = 15;
        const range = maxH - minH;

        this.currentHeights = [
          Math.round(minH + range * baseLevel * this.barMultipliers[0]),
          Math.round(minH + range * baseLevel * this.barMultipliers[1]),
          Math.round(minH + range * baseLevel * this.barMultipliers[2]),
          Math.round(minH + range * baseLevel * this.barMultipliers[3]),
        ];

        this.notify();
      }

      this.animFrameId = requestAnimationFrame(tick);
    };

    this.animFrameId = requestAnimationFrame(tick);
  }

  public stop() {
    this.state = "idle";
    this.activeMessageId = null;
    this.targetEnergy = 0;
    this.currentEnergy = 0;
    this.currentHeights = [3, 3, 3, 3];
    if (this.wordDecayTimerId !== null) {
      window.clearTimeout(this.wordDecayTimerId);
      this.wordDecayTimerId = null;
    }
    if (this.wordProgressTimerId !== null) {
      window.clearTimeout(this.wordProgressTimerId);
      this.wordProgressTimerId = null;
    }
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.notify();
  }
}

export const speechReactiveService = new SpeechReactiveService();

/**
 * How long the Read Aloud control stays in its "preparing audio" state before
 * playback begins. This is a deliberate beat, not a network wait: the segmented
 * ring holds for long enough that it reads as the app analysing the reply and
 * choosing a voice, instead of an unexplained instant jump into speech. Speech
 * itself is deferred by the same amount so the equalizer never runs ahead of
 * the voice.
 */
export const SPEECH_PREPARE_MIN_MS = 2000;

/**
 * Safety net for engines that load voices lazily and therefore never fire
 * `onstart`. Without it the control could be stranded in the preparing state.
 */
export const SPEECH_START_WATCHDOG_MS = 8000;

export interface SpeakLifecycleCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
  onPause?: () => void;
  onResume?: () => void;
}

/**
 * Binds an utterance to the visualizer and holds playback back for
 * `SPEECH_PREPARE_MIN_MS`, so callers can render a loading state first and let
 * audio begin only afterwards. Playback is deliberately deferred rather than
 * muted-then-unmuted so the visualizer stays perfectly in sync with the voice.
 *
 * Returns a cancel function that disarms the pending timers — call it whenever
 * speech is cancelled elsewhere so a queued utterance can never start late.
 */
export function speakWithPrepareDelay(
  utterance: SpeechSynthesisUtterance,
  messageId: string,
  cleanText: string,
  callbacks?: SpeakLifecycleCallbacks
): () => void {
  let cancelled = false;
  let prepareTimerId: number | null = null;
  let watchdogTimerId: number | null = null;

  const clearTimers = () => {
    if (prepareTimerId !== null) {
      window.clearTimeout(prepareTimerId);
      prepareTimerId = null;
    }
    if (watchdogTimerId !== null) {
      window.clearTimeout(watchdogTimerId);
      watchdogTimerId = null;
    }
  };

  const clearWatchdog = () => {
    if (watchdogTimerId !== null) {
      window.clearTimeout(watchdogTimerId);
      watchdogTimerId = null;
    }
  };

  speechReactiveService.bindUtterance(utterance, messageId, cleanText, {
    onStart: () => {
      clearWatchdog();
      callbacks?.onStart?.();
    },
    onEnd: () => {
      clearTimers();
      callbacks?.onEnd?.();
    },
    onError: () => {
      clearTimers();
      callbacks?.onError?.();
    },
    onPause: () => callbacks?.onPause?.(),
    onResume: () => callbacks?.onResume?.(),
  });

  const synth = window.speechSynthesis;
  if (synth.paused) synth.resume();

  prepareTimerId = window.setTimeout(() => {
    prepareTimerId = null;
    if (cancelled) return;
    try {
      synth.speak(utterance);
    } catch {
      clearTimers();
      callbacks?.onError?.();
    }
  }, SPEECH_PREPARE_MIN_MS);

  watchdogTimerId = window.setTimeout(() => {
    watchdogTimerId = null;
    if (cancelled) return;
    if (speechReactiveService.getState() === "buffering") {
      clearTimers();
      callbacks?.onError?.();
    }
  }, SPEECH_START_WATCHDOG_MS);

  return () => {
    cancelled = true;
    clearTimers();
  };
}

export function useSpeechWaveBars(
  isSpeaking: boolean,
  speechState: SpeechVisualizerState,
  messageId: string
): { heights: [number, number, number, number]; isBuffering: boolean } {
  // Default resting height is 3px
  const [heights, setHeights] = useState<[number, number, number, number]>(
    () => {
      if (isSpeaking && speechState === "playing") {
        return [7, 14, 11, 8];
      }
      return [3, 3, 3, 3];
    }
  );

  useEffect(() => {
    if (!isSpeaking || speechState === "idle") {
      setHeights([3, 3, 3, 3]);
      return;
    }

    if (speechState === "buffering") {
      setHeights([3, 3, 3, 3]);
      return;
    }

    // If active in service, subscribe to real-time speech acoustic envelope
    const unsubscribe = speechReactiveService.subscribe(newHeights => {
      const activeId = speechReactiveService.getActiveMessageId();
      if (!activeId || activeId === messageId) {
        setHeights(newHeights);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isSpeaking, speechState, messageId]);

  return {
    heights,
    isBuffering: isSpeaking && speechState === "buffering",
  };
}
