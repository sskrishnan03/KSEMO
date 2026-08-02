import { VoicePreferences, InputMode } from './types';

export type { VoicePreferences };

const STORAGE_KEY = 'ksemo_voice_preferences';

const DEFAULT_PREFERENCES: VoicePreferences = {
  voiceId: 'auto',
  pitch: 1.0,
  rate: 1.0,
  volume: 0.9,
  language: 'en-US',
  inputMode: 'hands_free',
  wakeWordEnabled: false,
  wakeWord: 'Hey KSEMO',
  wakeWordSensitivity: 0.7,
  silenceDuration: 1500,
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
  handsFreeEnabled: true,
};

export class VoiceMemory {
  private preferences: VoicePreferences;
  private listeners: Set<(prefs: VoicePreferences) => void> = new Set();

  constructor() {
    this.preferences = this.load();
  }

  private load(): VoicePreferences {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load voice preferences:', e);
    }
    return { ...DEFAULT_PREFERENCES };
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.preferences));
    } catch (e) {
      console.warn('Failed to save voice preferences:', e);
    }
  }

  getPreferences(): VoicePreferences {
    return { ...this.preferences };
  }

  updatePreferences(updates: Partial<VoicePreferences>): void {
    this.preferences = { ...this.preferences, ...updates };
    this.save();
    this.notifyListeners();
  }

  resetToDefaults(): void {
    this.preferences = { ...DEFAULT_PREFERENCES };
    this.save();
    this.notifyListeners();
  }

  subscribe(listener: (prefs: VoicePreferences) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener({ ...this.preferences }));
  }

  // Convenience getters
  get voiceId(): string { return this.preferences.voiceId; }
  get pitch(): number { return this.preferences.pitch; }
  get rate(): number { return this.preferences.rate; }
  get volume(): number { return this.preferences.volume; }
  get language(): string { return this.preferences.language; }
  get inputMode(): InputMode { return this.preferences.inputMode; }
  get wakeWordEnabled(): boolean { return this.preferences.wakeWordEnabled; }
  get wakeWord(): string { return this.preferences.wakeWord; }
  get silenceDuration(): number { return this.preferences.silenceDuration; }
}

// Singleton instance
let instance: VoiceMemory | null = null;

export function getVoiceMemory(): VoiceMemory {
  if (!instance) {
    instance = new VoiceMemory();
  }
  return instance;
}
