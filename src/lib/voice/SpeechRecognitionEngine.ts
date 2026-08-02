import { TranscriptEvent, RecognitionConfig, VoiceEvent } from './types';

export class SpeechRecognitionEngine {
  private recognition: any = null;
  private isListening = false;
  private isContinuous = false;
  private silenceTimer: number | null = null;
  private lastSpeechTime = 0;
  private activeToken = 0;
  private lastStartToken = 0;
  private eventListeners: Map<string, Set<(event: VoiceEvent) => void>> = new Map();

  constructor() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported in this browser');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.setupRecognition();
  }

  private setupRecognition(): void {
    if (!this.recognition) return;

    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 3;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.emit('started', {});
      this.emit('state_change', { state: 'listening' });
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.emit('end', {});
      // Restart in continuous mode only if this is still the active session
      // (stop()/abort() bump activeToken, invalidating a stale restart).
      if (this.isContinuous && this.lastStartToken === this.activeToken) {
        try {
          this.recognition.start();
        } catch (e) {
          // Already started
        }
      }
    };

    this.recognition.onresult = (event: any) => {
      this.handleResult(event);
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      this.emit('error', { error: event.error });
      
      if (event.error === 'not-allowed') {
        this.emit('error', { error: 'microphone_denied' });
      }
    };
  }

  private handleResult(event: any): void {
    let interimTranscript = '';
    let finalTranscript = '';
    let confidence = 0;

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;

      if (result.isFinal) {
        finalTranscript += transcript;
        confidence = result[0].confidence;
      } else {
        interimTranscript += transcript;
      }

      // Detect language from result if available
      // const language = result[0]?.lang;
    }

    // Emit interim results for real-time display
    if (interimTranscript) {
      this.emit('transcript', {
        text: interimTranscript,
        isFinal: false,
        confidence: 0,
        timestamp: Date.now(),
      } as TranscriptEvent);
    }

    // Emit final results
    if (finalTranscript) {
      this.emit('transcript', {
        text: finalTranscript,
        isFinal: true,
        confidence,
        timestamp: Date.now(),
      } as TranscriptEvent);

      // Reset silence timer on final speech
      this.resetSilenceTimer();
    }
  }

  private resetSilenceTimer(): void {
    if (this.silenceTimer !== null) {
      clearTimeout(this.silenceTimer);
    }
    this.lastSpeechTime = Date.now();
  }

  start(config?: Partial<RecognitionConfig>): void {
    if (!this.recognition) {
      console.error('Speech recognition not available');
      return;
    }

    if (config) {
      if (config.language) this.recognition.lang = config.language;
      if (config.continuous !== undefined) {
        this.recognition.continuous = config.continuous;
        this.isContinuous = config.continuous;
      }
      if (config.interimResults !== undefined) {
        this.recognition.interimResults = config.interimResults;
      }
      if (config.maxAlternatives !== undefined) {
        this.recognition.maxAlternatives = config.maxAlternatives;
      }
    }

    this.activeToken++;
    this.lastStartToken = this.activeToken;
    try {
      this.recognition.start();
    } catch (e) {
      // Already started
    }
  }

  stop(): void {
    if (this.recognition) {
      this.isContinuous = false;
      this.activeToken++;
      try {
        this.recognition.stop();
      } catch (e) {
        // Already stopped
      }
    }
  }

  abort(): void {
    if (this.recognition) {
      this.isContinuous = false;
      this.activeToken++;
      try {
        this.recognition.abort();
      } catch (e) {
        // Already stopped
      }
    }
  }

  setSilenceDetection(duration: number, callback: () => void): void {
    if (this.silenceTimer !== null) {
      clearTimeout(this.silenceTimer);
    }

    this.silenceTimer = window.setTimeout(() => {
      const timeSinceLastSpeech = Date.now() - this.lastSpeechTime;
      if (timeSinceLastSpeech >= duration && this.lastSpeechTime > 0) {
        callback();
      }
    }, duration);
  }

  clearSilenceDetection(): void {
    if (this.silenceTimer !== null) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
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

  isSupported(): boolean {
    return this.recognition !== null;
  }

  isActive(): boolean {
    return this.isListening;
  }
}
