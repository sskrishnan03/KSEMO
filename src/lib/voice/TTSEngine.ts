import { TTSConfig, VoiceEvent } from './types';
import { loadVoices, pickVoice } from '../voices';

// Text-to-speech with a two-tier strategy:
//   1. Premium Voice (via server.cjs proxy → /api/tts). Streams an MP3 back,
//      played through Web Audio so it works identically in every browser.
//   2. Browser speechSynthesis — automatic fallback when /api/tts is
//      unavailable (no API key configured) or the request fails.

const PREMIUM_VOICE_RE = /^[a-zA-Z0-9_\-]{10,}$/;

export class TTSEngine {
  private isSpeaking = false;
  private eventListeners: Map<string, Set<(event: VoiceEvent) => void>> = new Map();
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private primedVoiceId: string | null = null;
  private audioCtx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private currentGain: GainNode | null = null;
  private premiumDisabled = false;

  constructor() {
    // Initialize voices
    loadVoices().catch(console.error);
  }

  // Preload the voice for a given preference so the first `speak()` call in a
  // session starts immediately instead of waiting for voice discovery. Also
  // creates/unlocks the Web Audio context inside the start gesture so Premium
  // playback is never blocked by autoplay policies.
  async prime(voiceId: string): Promise<void> {
    const ctx = this.ensureAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const config: TTSConfig = { voiceId, pitch: 1, rate: 1, volume: 1, language: undefined };
    await this.resolveVoice(config);
  }

  private ensureAudioContext(): AudioContext | null {
    if (this.audioCtx) return this.audioCtx;
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new Ctx();
    } catch (e) {
      console.error('Failed to create AudioContext:', e);
      this.audioCtx = null;
    }
    return this.audioCtx;
  }

  private async resolveVoice(config: TTSConfig): Promise<SpeechSynthesisVoice | null> {
    // Reuse the primed selection when the preference hasn't changed.
    if (this.primedVoiceId === config.voiceId && this.selectedVoice) {
      return this.selectedVoice;
    }

    const voices = await loadVoices();
    const selectedVoice = pickVoice(config.voiceId, voices);
    this.selectedVoice = selectedVoice;
    this.primedVoiceId = config.voiceId;
    return selectedVoice;
  }

  async speak(text: string, config: TTSConfig, onWordBoundary?: (spokenText: string) => void): Promise<boolean> {
    // Premium path (preferred — same high-quality voice in every browser).
    if (!this.premiumDisabled) {
      const audio = await this.tryPremium(text, config);
      if (audio && audio.byteLength > 0) {
        const ok = await this.playWebAudio(audio, text, config, onWordBoundary);
        if (ok) return true;
        // Fall through to browser synthesis if decoding/playback failed.
      }
    }
    return this.speakBrowser(text, config, onWordBoundary);
  }

  private async tryPremium(text: string, config: TTSConfig): Promise<ArrayBuffer | null> {
    try {
      const voiceId = config.voiceId && PREMIUM_VOICE_RE.test(config.voiceId) ? config.voiceId : '';
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId }),
      });
      if (!res.ok) {
        // 400 = server has no voice key configured; stop retrying.
        if (res.status === 400) this.premiumDisabled = true;
        return null;
      }
      return await res.arrayBuffer();
    } catch (e) {
      console.warn('Premium request failed, falling back to browser TTS:', e);
      return null;
    }
  }

  private async playWebAudio(
    audio: ArrayBuffer,
    text: string,
    config: TTSConfig,
    onWordBoundary?: (spokenText: string) => void
  ): Promise<boolean> {
    const ctx = this.ensureAudioContext();
    if (!ctx) return false;

    try {
      if (ctx.state === 'suspended') await ctx.resume();

      const buffer = await ctx.decodeAudioData(audio.slice(0));
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gain = ctx.createGain();
      gain.gain.value = Math.min(1, Math.max(0, config.volume ?? 1));
      source.connect(gain);
      gain.connect(ctx.destination);

      this.currentSource = source;
      this.currentGain = gain;
      this.isSpeaking = true;
      this.emit('state_change', { state: 'speaking' });

      const words = text.split(/\s+/).filter(Boolean);
      let wordTimer: number | undefined;
      let resolved = false;

      const done = () => {
        if (resolved) return;
        resolved = true;
        this.isSpeaking = false;
        if (wordTimer !== undefined) {
          clearInterval(wordTimer);
          wordTimer = undefined;
        }
        if (onWordBoundary && words.length > 0) {
          onWordBoundary(text.trim());
        }
        this.emit('state_change', { state: 'idle' });
      };

      if (onWordBoundary && words.length > 0) {
        const revealMs = Math.max(2500, words.length * 360);
        const perWordMs = Math.max(100, revealMs / words.length);
        let index = 0;
        onWordBoundary(words[0]);
        wordTimer = window.setInterval(() => {
          index += 1;
          if (index < words.length) {
            onWordBoundary(words.slice(0, index + 1).join(' '));
          }
        }, perWordMs);
      }

      return new Promise<boolean>((resolve) => {
        source.onended = () => {
          done();
          resolve(true);
        };
        source.start();
      });
    } catch (e) {
      console.warn('Web Audio playback failed, falling back to browser TTS:', e);
      this.isSpeaking = false;
      this.emit('state_change', { state: 'idle' });
      return false;
    }
  }

  private async speakBrowser(text: string, config: TTSConfig, onWordBoundary?: (spokenText: string) => void): Promise<boolean> {
    if (!('speechSynthesis' in window)) {
      console.error('Speech synthesis not supported');
      return false;
    }

    // Cancel any current speech
    this.cancel();

    // Stay silent if tab is hidden
    if (document.hidden || !document.hasFocus()) {
      return false;
    }

    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
    } catch (e) {
      console.warn('Failed to reset speech synthesis:', e);
    }

    const voices = await loadVoices();
    // Honor an explicitly selected voice first, so clicking a voice in the
    // Settings page's Top-5 list is always respected regardless of language.
    let selectedVoice: SpeechSynthesisVoice | null = null;
    if (config.voiceId && config.voiceId !== 'auto') {
      selectedVoice = pickVoice(config.voiceId, voices);
    }
    // Otherwise prefer a voice matching the requested language so multi-language
    // setups don't get spoken in the wrong accent.
    if (!selectedVoice && config.language) {
      const target = config.language.toLowerCase().replace('_', '-');
      const langVoices = voices.filter((v) => v.lang.toLowerCase().replace('_', '-') === target);
      if (langVoices.length) {
        selectedVoice = pickVoice(config.voiceId, langVoices);
      }
    }
    if (!selectedVoice) {
      selectedVoice = pickVoice(config.voiceId, voices);
    }
    this.selectedVoice = selectedVoice;

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.rate = config.rate;
    utterance.pitch = config.pitch;
    utterance.volume = config.volume;
    if (config.language) {
      utterance.lang = config.language;
    }

    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }

    return new Promise<boolean>((resolve) => {
      let resolved = false;
      const words = text.split(/\s+/).filter(Boolean);
      let wordTimer: number | undefined;

      const done = (ok: boolean) => {
        if (resolved) return;
        resolved = true;
        this.isSpeaking = false;
        if (wordTimer !== undefined) {
          clearInterval(wordTimer);
          wordTimer = undefined;
        }
        // Always finish the caption, even if boundary events were sparse.
        if (onWordBoundary && words.length > 0) {
          onWordBoundary(text.trim());
        }
        this.emit('state_change', { state: 'idle' });
        resolve(ok);
      };

      utterance.onstart = () => {
        this.isSpeaking = true;
        this.emit('state_change', { state: 'speaking' });
      };

      // Word-by-word caption reveal. Two sources feed it — real boundary
      // events (which can be sparse) and a fallback timer that always runs to
      // completion — so the caption never stalls partway through a sentence.
      if (onWordBoundary && words.length > 0) {
        const revealMs = Math.max(2500, words.length * 360);
        const perWordMs = Math.max(100, revealMs / words.length);
        let index = 0;
        let furthest = 1;

        const reveal = (count: number) => {
          if (resolved || count <= furthest) return;
          furthest = count;
          onWordBoundary(words.slice(0, count).join(' '));
        };

        utterance.onboundary = (e: SpeechSynthesisEvent) => {
          if (resolved) return;
          const charIndex = e.charIndex ?? 0;
          const charLength = e.charLength ?? 0;
          const end = charIndex + (charLength > 0 ? charLength : 0);
          const spaceIdx = text.indexOf(' ', end);
          const shown = text.slice(0, spaceIdx === -1 ? text.length : spaceIdx + 1).trim();
          const shownCount = shown ? shown.split(/\s+/).length : 0;
          if (shownCount) reveal(shownCount);
        };

        // Fallback: reveal one word per tick; boundary events may jump ahead.
        onWordBoundary(words[0]);
        wordTimer = window.setInterval(() => {
          index += 1;
          reveal(index);
          if (index >= words.length && wordTimer !== undefined) {
            clearInterval(wordTimer);
            wordTimer = undefined;
          }
        }, perWordMs);
      }

      // Safety timeout
      const timeoutMs = Math.max(15000, words.length * 350 + 8000);
      const timeoutId = setTimeout(() => {
        console.warn('TTS timeout triggered');
        try {
          window.speechSynthesis.cancel();
        } catch (e) {
          // Ignore
        }
        done(false);
      }, timeoutMs);

      utterance.onend = () => {
        clearTimeout(timeoutId);
        done(true);
      };

      utterance.onerror = () => {
        clearTimeout(timeoutId);
        done(false);
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  cancel(): void {
    // Stop Web Audio (Premium) playback.
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (e) {
        // Ignore
      }
      this.currentSource = null;
    }
    if (this.currentGain) {
      try {
        this.currentGain.disconnect();
      } catch (e) {
        // Ignore
      }
      this.currentGain = null;
    }
    // Stop browser speech synthesis.
    try {
      window.speechSynthesis.cancel();
    } catch (e) {
      // Ignore
    }
    this.isSpeaking = false;
  }

  pause(): void {
    try {
      window.speechSynthesis.pause();
    } catch (e) {
      // Ignore
    }
  }

  resume(): void {
    try {
      window.speechSynthesis.resume();
    } catch (e) {
      // Ignore
    }
  }

  isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }

  on(event: string, listener: (event: VoiceEvent) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  off(event: string, listener: (event: VoiceEvent) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  private emit(type: string, data: any): void {
    const event: VoiceEvent = {
      type: type as any,
      data,
      timestamp: Date.now(),
    };

    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }
  }

  // Web Audio is supported in every modern browser, so TTS is always available
  // (Premium when configured, otherwise browser speechSynthesis).
  isSupported(): boolean {
    return true;
  }

  async getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
    return loadVoices();
  }
}
