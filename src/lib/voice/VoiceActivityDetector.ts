import { VoiceEvent } from './types';

export interface VADConfig {
  threshold: number; // 0 to 1
  silenceDuration: number; // milliseconds
  minSpeechDuration: number; // milliseconds
}

export class VoiceActivityDetector {
  private analyser: AnalyserNode | null = null;
  private isDetecting = false;
  private eventListeners: Map<string, Set<(event: VoiceEvent) => void>> = new Map();
  private config: VADConfig;
  private speechStartTime: number | null = null;
  private silenceStartTime: number | null = null;
  private detectionInterval: number | null = null;
  private isInSpeech = false;

  constructor(config: Partial<VADConfig> = {}) {
    this.config = {
      threshold: config.threshold ?? 0.15,
      silenceDuration: config.silenceDuration ?? 800,
      minSpeechDuration: config.minSpeechDuration ?? 250,
    };
  }

  initialize(analyser: AnalyserNode): void {
    this.analyser = analyser;
  }

  updateConfig(config: Partial<VADConfig>): void {
    this.config = { ...this.config, ...config };
  }

  startDetection(sampleRate = 50): void {
    if (this.isDetecting) return;
    this.isDetecting = true;

    this.detectionInterval = window.setInterval(() => {
      this.detect();
    }, sampleRate);
  }

  stopDetection(): void {
    if (this.detectionInterval !== null) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
    this.isDetecting = false;
    this.speechStartTime = null;
    this.silenceStartTime = null;
    this.isInSpeech = false;
  }

  private detect(): void {
    if (!this.analyser) return;

    const level = this.getAudioLevel();
    const now = Date.now();

    if (level > this.config.threshold) {
      // Speech detected
      if (!this.isInSpeech) {
        this.speechStartTime = now;
        this.isInSpeech = true;
        this.silenceStartTime = null;
      } else if (this.speechStartTime && now - this.speechStartTime >= this.config.minSpeechDuration) {
        // Confirmed speech
        this.emit('speech_started', { level, timestamp: now });
      }
    } else {
      // Silence detected
      if (this.isInSpeech) {
        if (!this.silenceStartTime) {
          this.silenceStartTime = now;
        } else if (now - this.silenceStartTime >= this.config.silenceDuration) {
          // Speech ended
          this.emit('speech_ended', { duration: now - (this.speechStartTime || now), timestamp: now });
          this.isInSpeech = false;
          this.speechStartTime = null;
          this.silenceStartTime = null;
        }
      }
    }
  }

  private getAudioLevel(): number {
    if (!this.analyser) return 0;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    const sum = dataArray.reduce((a, b) => a + b, 0);
    return sum / dataArray.length / 255;
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
    return this.isDetecting;
  }

  isInSpeechState(): boolean {
    return this.isInSpeech;
  }
}
