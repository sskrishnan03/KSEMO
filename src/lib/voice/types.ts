// Core voice engine types

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted' | 'error' | 'reconnecting';

export type InputMode = 'hands_free' | 'push_to_talk' | 'wake_word';

export type Emotion = 'happy' | 'sad' | 'excited' | 'angry' | 'calm' | 'nervous' | 'confused' | 'professional' | 'friendly' | 'neutral';

export interface VoicePreferences {
  voiceId: string;
  pitch: number; // 0.5 to 2.0
  rate: number; // 0.5 to 2.0
  volume: number; // 0 to 1
  language: string;
  inputMode: InputMode;
  wakeWordEnabled: boolean;
  wakeWord: string;
  wakeWordSensitivity: number; // 0 to 1
  silenceDuration: number; // milliseconds
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  handsFreeEnabled: boolean;
}

export interface TranscriptEvent {
  text: string;
  isFinal: boolean;
  confidence: number;
  timestamp: number;
  language?: string;
}

export interface EmotionData {
  emotion: Emotion;
  confidence: number;
  pitch: number;
  energy: number;
  speakingRate: number;
}

export interface VoiceEvent {
  type: string;
  data: any;
  timestamp: number;
}

export interface AudioConfig {
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  channelCount: number;
  sampleRate: number;
}

export interface TTSConfig {
  voiceId: string;
  pitch: number;
  rate: number;
  volume: number;
  language?: string;
}

export interface RecognitionConfig {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  stream?: MediaStream;
}

export interface STTProvider {
  start(config?: Partial<RecognitionConfig>): void;
  stop(): void;
  abort(): void;
  // Flush any pending recorded audio to the STT service and emit the
  // resulting transcript (used on VAD silence in hands-free mode).
  flushPending?(): void;
  isSupported(): boolean;
  isActive(): boolean;
  getProviderId(): 'webspeech' | 'mediarecorder' | 'streaming';
  on(event: string, listener: (event: VoiceEvent) => void): void;
  off(event: string, listener: (event: VoiceEvent) => void): void;
}
