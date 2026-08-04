import { VoiceState, VoicePreferences, TranscriptEvent, EmotionData, VoiceEvent, AudioConfig, TTSConfig, RecognitionConfig, STTProvider } from './types';
import { AudioManager } from './AudioManager';
import { SpeechRecognitionEngine } from './SpeechRecognitionEngine';
import { DeepgramStreamingSTT } from './DeepgramStreamingSTT';
import { TTSEngine } from './TTSEngine';
import { EmotionDetector } from './EmotionDetector';
import { VoiceActivityDetector } from './VoiceActivityDetector';
import { WakeWordDetector } from './WakeWordDetector';
import { VoiceMemory, getVoiceMemory } from './VoiceMemory';

export class VoiceEngine {
  private audioManager: AudioManager;
  private recognition: STTProvider;
  private tts: TTSEngine;
  private emotionDetector: EmotionDetector;
  private vad: VoiceActivityDetector;
  private wakeWordDetector: WakeWordDetector;
  private voiceMemory: VoiceMemory;

  private state: VoiceState = 'idle';
  private eventListeners: Map<string, Set<(event: VoiceEvent) => void>> = new Map();
  private currentTranscript = '';
  private abortController: AbortController | null = null;

  private readonly onTranscript = (event: VoiceEvent) => {
    const transcriptEvent = event.data as TranscriptEvent;
    this.currentTranscript = transcriptEvent.text;

    if (transcriptEvent.isFinal) {
      this.emit('transcript_final', transcriptEvent);
    } else {
      this.emit('transcript_interim', transcriptEvent);
    }
  };

  private readonly onRecognitionError = (event: VoiceEvent) => {
    const data = event.data as { error?: string } | undefined;
    if (data && typeof data === 'object') {
      // Non-recoverable failures: swap to Web Speech so voice keeps working.
      if (data.error === 'deepgram_auth_failed' || data.error === 'audio_setup_failed') {
        void this.fallbackToWebSpeech();
      }
    }
    this.emit('error', event.data);
  };

  constructor() {
    this.audioManager = new AudioManager();
    // Deepgram streaming STT when a key is configured (low-latency interim
    // results), otherwise the free browser Web Speech engine.
    this.recognition = DeepgramStreamingSTT.isSupported()
      ? new DeepgramStreamingSTT({ getStream: () => this.audioManager.getStream() })
      : new SpeechRecognitionEngine();
    this.tts = new TTSEngine();
    this.emotionDetector = new EmotionDetector();
    this.vad = new VoiceActivityDetector();
    this.wakeWordDetector = new WakeWordDetector();
    this.voiceMemory = getVoiceMemory();

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Speech recognition events
    this.recognition.on('transcript', this.onTranscript);

    this.recognition.on('error', this.onRecognitionError);

    // VAD events
    this.vad.on('speech_started', (event) => {
      this.emit('speech_started', event.data);
    });

    this.vad.on('speech_ended', (event) => {
      this.emit('speech_ended', event.data);
    });

    // Emotion detection events
    this.emotionDetector.on('emotion', (event) => {
      this.emit('emotion_detected', event.data as EmotionData);
    });

    // Wake word events
    this.wakeWordDetector.on('wake_word_detected', (event) => {
      this.emit('wake_word_detected', event.data);
    });

    // TTS events
    this.tts.on('state_change', (event) => {
      if (event.data.state === 'speaking') {
        this.setState('speaking');
      } else if (event.data.state === 'idle') {
        if (this.state === 'speaking') {
          this.setState('listening');
        }
      }
    });

    // Voice memory changes
    this.voiceMemory.subscribe((prefs: VoicePreferences) => {
      this.emit('preferences_changed', prefs);
    });
  }

  // If the Deepgram connection fails (bad/expired key, no credits, network),
  // swap to the free browser Web Speech engine and keep the session going so
  // the voice feature never silently stops working.
  private async fallbackToWebSpeech(): Promise<void> {
    if (this.recognition.getProviderId() !== 'deepgram') return;
    console.warn('Deepgram STT unavailable; switching to browser Web Speech.');

    const wasListening = this.recognition.isActive() || this.state === 'listening';
    this.recognition.stop();
    this.recognition.off('transcript', this.onTranscript);
    this.recognition.off('error', this.onRecognitionError);

    this.recognition = new SpeechRecognitionEngine();
    this.recognition.on('transcript', this.onTranscript);
    this.recognition.on('error', this.onRecognitionError);

    if (wasListening) {
      const prefs = this.voiceMemory.getPreferences();
      this.recognition.start({
        language: prefs.language,
        continuous: true,
        interimResults: true,
        maxAlternatives: 3,
      });
    }
    this.emit('stt_fallback', { timestamp: Date.now() });
  }

  async initialize(): Promise<void> {
    const prefs = this.voiceMemory.getPreferences();

    const audioConfig: AudioConfig = {
      echoCancellation: prefs.echoCancellation,
      noiseSuppression: prefs.noiseSuppression,
      autoGainControl: prefs.autoGainControl,
      channelCount: 1,
      sampleRate: 44100,
    };

    await this.audioManager.initialize(audioConfig);

    const analyser = this.audioManager.getAnalyser();
    if (analyser) {
      await this.emotionDetector.initialize(analyser);
      this.vad.initialize(analyser);
    }

    await this.wakeWordDetector.initialize();

    this.vad.updateConfig({
      threshold: 0.15,
      silenceDuration: prefs.silenceDuration,
      minSpeechDuration: 250,
    });

    this.wakeWordDetector.updateConfig({
      wakeWord: prefs.wakeWord,
      sensitivity: prefs.wakeWordSensitivity,
      debounceMs: 2000,
    });
  }

  async startSession(): Promise<void> {
    if (this.state !== 'idle') return;

    await this.initialize();
    const prefs = this.voiceMemory.getPreferences();

    if (prefs.inputMode === 'wake_word' && prefs.wakeWordEnabled) {
      this.wakeWordDetector.startListening();
      this.setState('idle');
    } else if (prefs.inputMode === 'push_to_talk') {
      this.setState('idle');
    } else {
      // Hands-free mode
      this.startListening();
    }
  }

  async stopSession(): Promise<void> {
    this.stopListening();
    this.tts.cancel();
    this.emotionDetector.stopAnalysis();
    this.vad.stopDetection();
    this.wakeWordDetector.stopListening();
    await this.audioManager.stop();
    this.setState('idle');
  }

  startListening(): void {
    const prefs = this.voiceMemory.getPreferences();
    const recognitionConfig: RecognitionConfig = {
      language: prefs.language,
      continuous: true,
      interimResults: true,
      maxAlternatives: 3,
    };

    this.recognition.start(recognitionConfig);
    this.vad.startDetection(50);
    this.emotionDetector.startAnalysis(100);
    this.setState('listening');
  }

  stopListening(): void {
    this.recognition.stop();
    this.vad.stopDetection();
    this.emotionDetector.stopAnalysis();
    
    if (this.state === 'listening') {
      this.setState('idle');
    }
  }

  async speak(text: string, overrides?: Partial<TTSConfig>, onWordBoundary?: (spokenText: string) => void): Promise<boolean> {
    const prefs = this.voiceMemory.getPreferences();
    const ttsConfig: TTSConfig = {
      voiceId: prefs.voiceId,
      pitch: prefs.pitch,
      rate: prefs.rate,
      volume: prefs.volume,
      language: prefs.language,
      ...overrides,
    };

    return this.tts.speak(text, ttsConfig, onWordBoundary);
  }

  // Preload the chosen voice once per session so the first spoken sentence
  // doesn't have to wait for voice discovery + selection to finish.
  async primeVoice(voiceId: string): Promise<void> {
    return this.tts.prime(voiceId);
  }

  // True when a low-latency streaming STT provider (Deepgram) is active, so
  // the UI can safely react to VAD silence + interim transcripts instead of
  // waiting for a slow "final" result.
  isLowLatencySTT(): boolean {
    return this.recognition.getProviderId() === 'deepgram';
  }

  interrupt(): void {
    // Feature 1: Natural Interruption (Barge-In)
    // Stop TTS immediately
    this.tts.cancel();
    
    // Cancel any ongoing AI request
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    // Start listening immediately
    this.setState('interrupted');
    this.emit('interrupted', { timestamp: Date.now() });

    // Resume listening after brief delay
    setTimeout(() => {
      if (this.state === 'interrupted') {
        this.startListening();
      }
    }, 100);
  }

  activatePushToTalk(): void {
    this.startListening();
    this.emit('push_to_talk_activated', { timestamp: Date.now() });
  }

  deactivatePushToTalk(): void {
    this.stopListening();
    this.emit('push_to_talk_deactivated', { timestamp: Date.now() });
  }

  setAbortController(controller: AbortController): void {
    this.abortController = controller;
  }

  // Watch the mic (VAD only, recognition stays off) so a user can interrupt
  // the assistant mid-speech. Uses a higher threshold than normal listening so
  // the assistant's own voice doesn't trigger it (echo cancellation helps too).
  startBargeInMonitoring(): void {
    this.vad.updateConfig({
      threshold: 0.3,
      silenceDuration: 800,
      minSpeechDuration: 300,
    });
    if (!this.vad.isActive()) {
      this.vad.startDetection(50);
    }
  }

  stopBargeInMonitoring(): void {
    const prefs = this.voiceMemory.getPreferences();
    this.vad.updateConfig({
      threshold: 0.15,
      silenceDuration: prefs.silenceDuration,
      minSpeechDuration: 250,
    });
    this.vad.stopDetection();
  }

  startWakeWordStandby(): void {
    this.wakeWordDetector.startListening();
  }

  stopWakeWordStandby(): void {
    this.wakeWordDetector.stopListening();
  }

  private setState(newState: VoiceState): void {
    if (this.state === newState) return;
    this.state = newState;
    this.emit('state_change', { state: newState, timestamp: Date.now() });
  }

  getState(): VoiceState {
    return this.state;
  }

  getCurrentTranscript(): string {
    return this.currentTranscript;
  }

  getAudioLevel(): number {
    return this.audioManager.getAudioLevel();
  }

  getAudioData(): Uint8Array {
    return this.audioManager.getAudioData();
  }

  getPreferences(): VoicePreferences {
    return this.voiceMemory.getPreferences();
  }

  updatePreferences(updates: Partial<VoicePreferences>): void {
    this.voiceMemory.updatePreferences(updates);
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
    return this.recognition.isSupported() && this.tts.isSupported();
  }

  isActive(): boolean {
    return this.state !== 'idle';
  }
}

// Singleton instance
let instance: VoiceEngine | null = null;

export function getVoiceEngine(): VoiceEngine {
  if (!instance) {
    instance = new VoiceEngine();
  }
  return instance;
}
