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
    this.selectedVoice = pickVoice(config.voiceId, voices);

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.rate = config.rate;
    utterance.pitch = config.pitch;
    utterance.volume = config.volume;

    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }

    return new Promise<boolean>((resolve) => {
      let resolved = false;
      const words = text.split(/\s+/).filter(Boolean);
      let wordTimer: number | undefined;
      let boundaryFired = false;

      const done = () => {
        if (resolved) return;
        resolved = true;
        this.isSpeaking = false;
        if (wordTimer !== undefined) {
          clearInterval(wordTimer);
        }
        this.emit('state_change', { state: 'idle' });
        resolve(false);
      };

      utterance.onend = done;
      utterance.onerror = done;
      utterance.onstart = () => {
        this.isSpeaking = true;
        this.emit('state_change', { state: 'speaking' });
      };

      // Word boundary handling for streaming text display
      if (onWordBoundary && words.length > 0) {
        const revealMs = Math.max(2500, words.length * 360);
        const perWordMs = Math.max(100, revealMs / words.length);
        let index = 0;

        utterance.onboundary = (e: SpeechSynthesisEvent) => {
          if (resolved) return;
          boundaryFired = true;
          if (wordTimer !== undefined) {
            clearInterval(wordTimer);
            wordTimer = undefined;
          }

          const charIndex = e.charIndex ?? 0;
          const charLength = e.charLength ?? 0;
          const end = charIndex + (charLength > 0 ? charLength : 0);
          const spaceIdx = text.indexOf(' ', end);
          const shown = text.slice(0, spaceIdx === -1 ? text.length : spaceIdx + 1).trim();
          onWordBoundary(shown || text.slice(0, charIndex).trim());
        };

        // Fallback timer if boundary events don't fire
        onWordBoundary(words[0]);
        wordTimer = window.setInterval(() => {
          if (boundaryFired) {
            if (wordTimer !== undefined) {
              clearInterval(wordTimer);
              wordTimer = undefined;
            }
            return;
          }
          index += 1;
          onWordBoundary(words.slice(0, index).join(' '));
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
        done();
      }, timeoutMs);

      utterance.onend = () => {
        clearTimeout(timeoutId);
        done();
      };

      utterance.onerror = () => {
        clearTimeout(timeoutId);
        done();
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
