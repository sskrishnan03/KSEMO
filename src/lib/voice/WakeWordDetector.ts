import { VoiceEvent } from './types';

export interface WakeWordConfig {
  wakeWord: string;
  sensitivity: number; // 0 to 1
  debounceMs: number;
}

export class WakeWordDetector {
  private isListening = false;
  private eventListeners: Map<string, Set<(event: VoiceEvent) => void>> = new Map();
  private config: WakeWordConfig;
  private lastDetectionTime = 0;
  private recognition: any = null;

  constructor(config: Partial<WakeWordConfig> = {}) {
    this.config = {
      wakeWord: config.wakeWord ?? 'Hey KSEMO',
      sensitivity: config.sensitivity ?? 0.7,
      debounceMs: config.debounceMs ?? 2000,
    };
  }

  async initialize(): Promise<void> {

    // Use speech recognition for wake word detection (more accurate than audio analysis)
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.setupRecognition();
    }
  }

  private setupRecognition(): void {
    if (!this.recognition) return;

    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event: any) => {
      this.handleResult(event);
    };

    this.recognition.onerror = (event: any) => {
      console.error('Wake word recognition error:', event.error);
    };
  }

  private handleResult(event: any): void {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript.toLowerCase();
      
      if (this.checkWakeWord(transcript)) {
        const now = Date.now();
        if (now - this.lastDetectionTime >= this.config.debounceMs) {
          this.lastDetectionTime = now;
          this.emit('wake_word_detected', { wakeWord: this.config.wakeWord, transcript });
        }
      }
    }
  }

  private checkWakeWord(transcript: string): boolean {
    const wakeWords = this.config.wakeWord.toLowerCase().split(',').map(w => w.trim());
    const normalizedTranscript = transcript.toLowerCase().replace(/[.,!?]/g, '');

    return wakeWords.some(wakeWord => {
      return normalizedTranscript.includes(wakeWord) || 
             normalizedTranscript.startsWith(wakeWord) ||
             normalizedTranscript.endsWith(wakeWord);
    });
  }

  startListening(): void {
    if (this.isListening) return;
    this.isListening = true;

    if (this.recognition) {
      try {
        this.recognition.start();
      } catch (e) {
        // Already started
      }
    }
  }

  stopListening(): void {
    if (!this.isListening) return;
    this.isListening = false;

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Already stopped
      }
    }
  }

  updateConfig(config: Partial<WakeWordConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.wakeWord && this.recognition) {
      // Restart recognition with new wake word
      this.stopListening();
      this.setupRecognition();
      this.startListening();
    }
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

  isActive(): boolean {
    return this.isListening;
  }

  isSupported(): boolean {
    return this.recognition !== null;
  }
}
