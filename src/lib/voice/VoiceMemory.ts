import { VoicePreferences, InputMode } from './types';

export type { VoicePreferences };

const STORAGE_KEY = 'ksemo_voice_preferences';
// Bumped whenever a stored preference's default changes so existing users get
// the improved value instead of keeping the old default forever.
const STORAGE_VERSION = 2;

const DEFAULT_PREFERENCES: VoicePreferences = {
  voiceId: 'auto',
  pitch: 1.0,
  rate: 1.0,
  volume: 0.7,
  language: 'en-US',
  inputMode: 'hands_free',
  wakeWordEnabled: false,
  wakeWord: 'Hey KSEMO',
  wakeWordSensitivity: 0.7,
  // Snappy turn-around: transcribe as soon as ~0.7s of silence follows speech
  // (was 1500ms, which made every reply feel sluggish).
  silenceDuration: 700,
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
        const parsed = JSON.parse(stored) as Partial<VoicePreferences> & { version?: number };
        const prefs: VoicePreferences = { ...DEFAULT_PREFERENCES, ...parsed };
        // v2: adopt the shorter silence duration instead of the old 1.5s
        // default that was saved before this change.
        if (parsed.version !== STORAGE_VERSION) {
          prefs.silenceDuration = DEFAULT_PREFERENCES.silenceDuration;
        }
        return prefs;
      }
    } catch (e) {
      console.warn('Failed to load voice preferences:', e);
    }
    return { ...DEFAULT_PREFERENCES };
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...this.preferences, version: STORAGE_VERSION }));
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
