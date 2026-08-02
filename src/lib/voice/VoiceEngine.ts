import { VoiceState, VoicePreferences, TranscriptEvent, EmotionData, VoiceEvent, AudioConfig, TTSConfig, RecognitionConfig } from './types';
import { AudioManager } from './AudioManager';
import { SpeechRecognitionEngine } from './SpeechRecognitionEngine';
import { TTSEngine } from './TTSEngine';
import { EmotionDetector } from './EmotionDetector';
import { VoiceActivityDetector } from './VoiceActivityDetector';
import { WakeWordDetector } from './WakeWordDetector';
import { VoiceMemory, getVoiceMemory } from './VoiceMemory';
import { PluginIntegrator } from './PluginIntegrator';
import { initializePlugins } from '../plugins';

export class VoiceEngine {
  private audioManager: AudioManager;
  private recognition: SpeechRecognitionEngine;
  private tts: TTSEngine;
  private emotionDetector: EmotionDetector;
  private vad: VoiceActivityDetector;
  private wakeWordDetector: WakeWordDetector;
  private voiceMemory: VoiceMemory;

  private state: VoiceState = 'idle';
  private eventListeners: Map<string, Set<(event: VoiceEvent) => void>> = new Map();
  private currentTranscript = '';
  private abortController: AbortController | null = null;
  private pluginIntegrator: PluginIntegrator | null = null;

  constructor() {
    this.audioManager = new AudioManager();
    this.recognition = new SpeechRecognitionEngine();
    this.tts = new TTSEngine();
    this.emotionDetector = new EmotionDetector();
    this.vad = new VoiceActivityDetector();
    this.wakeWordDetector = new WakeWordDetector();
    this.voiceMemory = getVoiceMemory();

    // Initialize plugins
    initializePlugins();

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Speech recognition events
    this.recognition.on('transcript', (event) => {
      const transcriptEvent = event.data as TranscriptEvent;
      this.currentTranscript = transcriptEvent.text;
      
      if (transcriptEvent.isFinal) {
        this.emit('transcript_final', transcriptEvent);
      } else {
        this.emit('transcript_interim', transcriptEvent);
      }
    });

    this.recognition.on('error', (event) => {
      this.emit('error', event.data);
    });

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

  async initialize(): Promise<void> {
    // Initialize plugin integrator
    this.pluginIntegrator = new PluginIntegrator({
      userId: 'user',
      voiceEngine: this,
      sendMessage: (message: string) => {
        this.emit('plugin_message', { message });
      },
    });

    const prefs = this.voiceMemory.getPreferences();

    const audioConfig: AudioConfig = {
      echoCancellation: prefs.echoCancellation,
      noiseSuppression: prefs.noiseSuppression,
      autoGainControl: prefs.autoGainControl,
      channelCount: 1,
      sampleRate: 44100,
    };

    await this.audioManager.initialize(audioConfig);

    const analyser = this.audioManager.getAudioContext()?.createAnalyser();
    if (analyser) {
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;

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

  async speak(text: string, onWordBoundary?: (spokenText: string) => void): Promise<boolean> {
    const prefs = this.voiceMemory.getPreferences();
    const ttsConfig: TTSConfig = {
      voiceId: prefs.voiceId,
      pitch: prefs.pitch,
      rate: prefs.rate,
      volume: prefs.volume,
    };

    return this.tts.speak(text, ttsConfig, onWordBoundary);
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

  async processPluginCommand(transcript: string): Promise<any> {
    if (!this.pluginIntegrator) return null;
    return await this.pluginIntegrator.processVoiceCommand(transcript);
  }

  getAvailablePluginActions(): any[] {
    if (!this.pluginIntegrator) return [];
    return this.pluginIntegrator.getAvailableActions();
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
