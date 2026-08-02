import { TTSConfig, VoiceEvent } from './types';
import { loadVoices, pickVoice } from '../voices';

export class TTSEngine {
  private isSpeaking = false;
  private eventListeners: Map<string, Set<(event: VoiceEvent) => void>> = new Map();
  private selectedVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    // Initialize voices
    loadVoices().catch(console.error);
  }

  async speak(text: string, config: TTSConfig, onWordBoundary?: (spokenText: string) => void): Promise<boolean> {
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

  isSupported(): boolean {
    return 'speechSynthesis' in window;
  }

  async getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
    return loadVoices();
  }
}
