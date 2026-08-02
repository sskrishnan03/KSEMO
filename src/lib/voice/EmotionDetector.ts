import { Emotion, EmotionData, VoiceEvent } from './types';

export class EmotionDetector {
  private analyser: AnalyserNode | null = null;
  private eventListeners: Map<string, Set<(event: VoiceEvent) => void>> = new Map();
  private isAnalyzing = false;
  private analysisInterval: number | null = null;

  async initialize(analyser: AnalyserNode): Promise<void> {
    this.analyser = analyser;
  }

  startAnalysis(sampleRate = 100): void {
    if (this.isAnalyzing) return;
    this.isAnalyzing = true;

    this.analysisInterval = window.setInterval(() => {
      this.analyzeEmotion();
    }, sampleRate);
  }

  stopAnalysis(): void {
    if (this.analysisInterval !== null) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
    this.isAnalyzing = false;
  }

  private analyzeEmotion(): void {
    if (!this.analyser) return;

    const timeData = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(timeData);

    const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(frequencyData);

    const emotionData = this.calculateEmotion(timeData, frequencyData);
    this.emit('emotion', emotionData);
  }

  private calculateEmotion(timeData: Uint8Array, frequencyData: Uint8Array): EmotionData {
    // Calculate basic audio features
    const energy = this.calculateEnergy(frequencyData);
    const pitch = this.calculatePitch(timeData);
    const speakingRate = this.calculateSpeakingRate(timeData);

    // Determine emotion based on features
    const emotion = this.classifyEmotion(energy, pitch, speakingRate);
    const confidence = this.calculateConfidence(energy, pitch, speakingRate, emotion);

    return {
      emotion,
      confidence,
      pitch,
      energy,
      speakingRate,
    };
  }

  private calculateEnergy(frequencyData: Uint8Array): number {
    const sum = frequencyData.reduce((a, b) => a + b, 0);
    return sum / frequencyData.length / 255;
  }

  private calculatePitch(timeData: Uint8Array): number {
    // Zero-crossing rate as a simple pitch approximation
    let zeroCrossings = 0;
    for (let i = 1; i < timeData.length; i++) {
      if ((timeData[i] > 128 && timeData[i - 1] <= 128) ||
          (timeData[i] <= 128 && timeData[i - 1] > 128)) {
        zeroCrossings++;
      }
    }
    return zeroCrossings / timeData.length;
  }

  private calculateSpeakingRate(timeData: Uint8Array): number {
    // Variance in amplitude as a proxy for speaking rate
    const mean = timeData.reduce((a, b) => a + b, 0) / timeData.length;
    const variance = timeData.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / timeData.length;
    return Math.sqrt(variance) / 128;
  }

  private classifyEmotion(energy: number, pitch: number, speakingRate: number): Emotion {
    // Simple heuristic-based emotion classification
    // In production, this would use a trained ML model

    if (energy > 0.7 && speakingRate > 0.5) {
      return 'excited';
    }

    if (energy < 0.2 && pitch < 0.3) {
      return 'sad';
    }

    if (energy > 0.6 && pitch > 0.6) {
      return 'angry';
    }

    if (energy < 0.4 && speakingRate < 0.3) {
      return 'calm';
    }

    if (pitch > 0.7 && energy > 0.4) {
      return 'happy';
    }

    if (speakingRate > 0.6 && energy < 0.5) {
      return 'nervous';
    }

    if (energy < 0.3 && speakingRate < 0.4) {
      return 'confused';
    }

    if (energy > 0.4 && energy < 0.6 && speakingRate > 0.3 && speakingRate < 0.5) {
      return 'professional';
    }

    if (energy > 0.5 && pitch < 0.5) {
      return 'friendly';
    }

    return 'neutral';
  }

  private calculateConfidence(energy: number, pitch: number, speakingRate: number, emotion: Emotion): number {
    // Confidence based on how clearly the features match the emotion
    let confidence = 0.5;

    switch (emotion) {
      case 'excited':
        confidence = (energy > 0.7 ? 0.3 : 0) + (speakingRate > 0.5 ? 0.3 : 0) + 0.4;
        break;
      case 'sad':
        confidence = (energy < 0.2 ? 0.3 : 0) + (pitch < 0.3 ? 0.3 : 0) + 0.4;
        break;
      case 'angry':
        confidence = (energy > 0.6 ? 0.3 : 0) + (pitch > 0.6 ? 0.3 : 0) + 0.4;
        break;
      case 'calm':
        confidence = (energy < 0.4 ? 0.3 : 0) + (speakingRate < 0.3 ? 0.3 : 0) + 0.4;
        break;
      default:
        confidence = 0.5;
    }

    return Math.min(1, Math.max(0, confidence));
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
    return this.isAnalyzing;
  }
}
