import { RecognitionConfig, TranscriptEvent, VoiceEvent } from './types';
import workletSource from './deepgram-audio-processor.js?raw';

export interface DeepgramSTTConfig {
  getStream: () => MediaStream | null;
  language?: string;
  model?: string;
  sampleRate?: number;
  endpointingMs?: number;
  minSpeechRms?: number;
  preRollMs?: number;
}

interface DeepgramResultMessage {
  type: 'Results';
  channel?: {
    alternatives?: { transcript?: string; confidence?: number }[];
  };
  is_final?: boolean;
  speech_final?: boolean;
}

const SAMPLE_RATE = 16000;
const BUFFER_SIZE = 2048; // ~128ms at 16kHz (matches the worklet's frame size)
const WORKLET_NAME = 'deepgram-audio-processor';
const ENDPOINTING_MS = 500;
const MIN_SPEECH_RMS = 0.02;

// Cached Blob URL for the audio worklet. Kept alive for the page lifetime so
// repeated addModule() calls (one per new AudioContext) always resolve.
let workletModuleUrl: string | null = null;

/**
 * Streaming speech-to-text provider backed by Deepgram's Live API (Nova-3).
 * Emits the same events as the Web Speech engine (`transcript`, `started`,
 * `end`, `error`) so the rest of the voice stack stays provider-agnostic.
 *
 * Only used when a Deepgram API key is configured; otherwise the app falls
 * back to the free browser Web Speech engine.
 *
 * Audio flow:
 *  - A dedicated 16kHz AudioContext captures the mic (never routed to the
 *    speakers, so it can't feed back into the assistant's voice).
 *  - A short pre-roll buffer keeps ~500ms of recent audio so the beginning
 *    of an utterance is never clipped when the socket connects mid-speech.
 *  - Frames are only transmitted while speech energy is present (RMS gate),
 *    which keeps idle connection costs and background noise near zero.
 */
export class DeepgramStreamingSTT {
  private config: DeepgramSTTConfig;
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private mediaStream: MediaStream | null = null;

  private isListening = false;
  private isContinuous = false;
  private activeToken = 0;
  private lastStartToken = 0;
  private reconnectTimer: number | null = null;

  private preRoll: Float32Array[] = [];
  private preRollMax = 4;
  private speechActive = false;
  private silentChunks = 0;

  private eventListeners: Map<string, Set<(event: VoiceEvent) => void>> = new Map();

  constructor(config: DeepgramSTTConfig) {
    this.config = config;
    const preRollMs = config.preRollMs ?? 500;
    this.preRollMax = Math.max(1, Math.ceil((preRollMs / 1000) * SAMPLE_RATE / BUFFER_SIZE));
  }

  static isSupported(): boolean {
    return typeof WebSocket !== 'undefined' && !!import.meta.env.VITE_DEEPGRAM_API_KEY;
  }

  getProviderId(): 'deepgram' {
    return 'deepgram';
  }

  start(config?: Partial<RecognitionConfig>): void {
    if (!DeepgramStreamingSTT.isSupported()) return;
    if (config?.continuous !== undefined) this.isContinuous = config.continuous;
    if (config?.language) this.config.language = config.language;
    this.activeToken++;
    this.lastStartToken = this.activeToken;
    void this.openSocket();
  }

  private async openSocket(): Promise<void> {
    try {
      const currentStream = this.config.getStream();
      if (this.audioContext && this.mediaStream && this.mediaStream !== currentStream) {
        this.teardownAudio();
      }
      await this.setupAudioChain();
    } catch (err) {
      console.error('Deepgram audio setup failed:', err);
      this.emit('error', { error: 'audio_setup_failed' });
      return;
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try { await this.audioContext.resume(); } catch (e) { console.error('Deepgram resume failed:', e); }
    }
    this.connect();
  }

  private async setupAudioChain(): Promise<void> {
    if (this.audioContext) return;
    this.mediaStream = this.config.getStream();
    if (!this.mediaStream || !this.mediaStream.active) {
      throw new Error('No microphone stream available');
    }

    this.audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    if (!workletModuleUrl) {
      const blob = new Blob([workletSource], { type: 'text/javascript' });
      workletModuleUrl = URL.createObjectURL(blob);
    }
    await this.audioContext.audioWorklet.addModule(workletModuleUrl);

    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.workletNode = new AudioWorkletNode(this.audioContext, WORKLET_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 0,
    });
    this.workletNode.port.onmessage = (e: MessageEvent<Float32Array>) => {
      this.handleSamples(e.data);
    };
    // The worklet is never connected to the speakers, so the live mic can
    // never bleed back into the assistant's voice.
    source.connect(this.workletNode);
  }

  private teardownAudio(): void {
    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
      try { this.workletNode.disconnect(); } catch { /* noop */ }
      this.workletNode = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.mediaStream = null;
    this.preRoll = [];
    this.speechActive = false;
    this.silentChunks = 0;
  }

  private connect(): void {
    if (this.ws) {
      try { this.ws.close(); } catch { /* noop */ }
      this.ws = null;
    }

    const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
    if (!apiKey) return;

    const params = new URLSearchParams({
      model: this.config.model ?? 'nova-3',
      interim_results: 'true',
      smart_format: 'true',
      endpointing: String(this.config.endpointingMs ?? ENDPOINTING_MS),
      encoding: 'linear16',
      sample_rate: String(this.config.sampleRate ?? SAMPLE_RATE),
      language: this.config.language ?? 'en-US',
    });

    // Browser WebSockets can't set an Authorization header, so Deepgram's
    // documented browser auth passes the API key as a subprotocol value.
    const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params.toString()}`, ['token', apiKey]);
    this.ws = ws;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.isListening = true;
      // If speech began before the socket was ready, backfill the recent audio
      // so the start of the utterance isn't lost to the handshake.
      if (this.speechActive && this.preRoll.length) {
        for (const frame of this.preRoll) this.sendPcm(frame);
        this.preRoll = [];
      }
      this.emit('started', {});
      this.emit('state_change', { state: 'listening' });
    };

    ws.onmessage = (msg) => {
      if (this.ws !== ws) return;
      this.handleMessage(msg.data);
    };

    ws.onerror = (ev) => {
      console.error('Deepgram WebSocket error:', ev);
      this.emit('error', { error: 'deepgram_error' });
    };

    ws.onclose = (ev: CloseEvent) => {
      if (this.ws !== ws) return;
      this.isListening = false;
      this.emit('end', {});
      // Deepgram closes with 4001 (auth failed) / 4002 (authorization failed)
      // when the API key is invalid, expired, or lacks access. Reconnecting is
      // pointless, so surface the error and let the caller fall back.
      if (ev.code === 4001 || ev.code === 4002) {
        this.isContinuous = false;
        this.activeToken++;
        this.emit('error', { error: 'deepgram_auth_failed' });
        return;
      }
      if (this.isContinuous && this.lastStartToken === this.activeToken) {
        this.scheduleReconnect();
      }
    };
  }

  private handleMessage(data: unknown): void {
    if (typeof data !== 'string') return;

    let msg: DeepgramResultMessage | null = null;
    try {
      msg = JSON.parse(data) as DeepgramResultMessage;
    } catch {
      return;
    }

    if (!msg) return;
    if (msg.type !== 'Results') {
      if ((msg as { type?: string }).type === 'Error') {
        this.emit('error', { error: 'deepgram_request_error' });
      }
      return;
    }

    const alternative = msg.channel?.alternatives?.[0];
    const transcript = alternative?.transcript ?? '';
    if (!transcript) return;

    this.emit('transcript', {
      text: transcript,
      isFinal: !!msg.is_final,
      confidence: alternative?.confidence ?? 0,
      timestamp: Date.now(),
    } as TranscriptEvent);
  }

  private handleSamples(samples: Float32Array): void {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    const rms = Math.sqrt(sum / samples.length);

    this.preRoll.push(samples.slice());
    if (this.preRoll.length > this.preRollMax) this.preRoll.shift();

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const minRms = this.config.minSpeechRms ?? MIN_SPEECH_RMS;
    if (rms >= minRms) {
      if (!this.speechActive) {
        for (const frame of this.preRoll) this.sendPcm(frame);
        this.preRoll = [];
        this.speechActive = true;
      }
      this.sendPcm(samples);
      this.silentChunks = 0;
    } else if (this.speechActive) {
      this.silentChunks++;
      if (this.silentChunks >= 3) {
        this.speechActive = false;
      }
    }
  }

  private sendPcm(samples: Float32Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const int16 = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    try {
      this.ws.send(int16.buffer);
    } catch (err) {
      console.error('Deepgram send failed:', err);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.isContinuous && this.lastStartToken === this.activeToken) {
        this.connect();
      }
    }, 500);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  stop(): void {
    this.isContinuous = false;
    this.activeToken++;
    this.clearReconnect();
    if (this.ws) {
      try { this.ws.close(); } catch { /* noop */ }
      this.ws = null;
    }
    this.isListening = false;
  }

  abort(): void {
    this.isContinuous = false;
    this.activeToken++;
    this.clearReconnect();
    if (this.ws) {
      try { this.ws.close(); } catch { /* noop */ }
      this.ws = null;
    }
    this.isListening = false;
  }

  isSupported(): boolean {
    return DeepgramStreamingSTT.isSupported();
  }

  isActive(): boolean {
    return this.isListening;
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

  private emit(type: string, data: unknown): void {
    const event: VoiceEvent = {
      type,
      data,
      timestamp: Date.now(),
    };
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }
  }
}
