import { TranscriptEvent, RecognitionConfig, VoiceEvent, STTProvider } from './types';

// Low-latency speech-to-text: mic PCM streams over a WebSocket to the server
// (/api/stt), which proxies to Deepgram's live API. Interim words arrive as
// you speak and a final transcript is emitted shortly after you stop — no
// waiting for a recorded blob upload + HTTP transcription round-trip.
//
// Falls back to MediaRecorderSTT (and then Web Speech) when WebSockets or
// script-processor capture are unavailable.

const SAMPLE_RATE = 16000;

// URL of the AudioWorklet processor module. It lives in public/ and is served
// verbatim at /pcm-worklet.js: a worklet module must be fetched from a real
// URL, and Vite inlines small ?url imports as data: URLs, which browsers
// reject for audioWorklet.addModule().
const PCM_WORKLET_URL = `${import.meta.env.BASE_URL}pcm-worklet.js`;

interface DeepgramLiveMessage {
  is_final?: boolean;
  channel?: {
    alternatives?: Array<{ transcript?: string; confidence?: number }>;
  };
}

function clamp16(v: number): number {
  const s = Math.max(-1, Math.min(1, v));
  return s < 0 ? (s * 0x8000) | 0 : (s * 0x7fff) | 0;
}

// Resample a mono Float32 chunk down to 16-bit PCM at 16kHz (linear
// interpolation), the format Deepgram's live API expects.
function downsampleToPcm16(input: Float32Array, fromRate: number): ArrayBuffer {
  if (fromRate === SAMPLE_RATE) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) out[i] = clamp16(input[i]);
    return out.buffer;
  }
  const ratio = fromRate / SAMPLE_RATE;
  const outLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const idx = i * ratio;
    const i0 = Math.floor(idx);
    const frac = idx - i0;
    const s0 = input[i0] ?? 0;
    const s1 = input[Math.min(i0 + 1, input.length - 1)] ?? 0;
    out[i] = clamp16(s0 + (s1 - s0) * frac);
  }
  return out.buffer;
}

export class StreamingDeepgramSTT implements STTProvider {
  private ws: WebSocket | null = null;
  private ctx: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private isListening = false;
  private config: Partial<RecognitionConfig> = {};
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private eventListeners: Map<string, Set<(event: VoiceEvent) => void>> = new Map();

  getProviderId(): 'streaming' {
    return 'streaming';
  }

  start(config?: Partial<RecognitionConfig>): void {
    if (!this.isListening) {
      this.isListening = true;
      this.emit('started', {});
      this.emit('state_change', { state: 'listening' });
    }
    if (config) this.config = { ...this.config, ...config };
    if (!this.ws) this.connect();
  }

  private connect(): void {
    if (!this.isListening || this.ws) return;
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${window.location.host}/api/stt`);
    this.ws = ws;
    ws.binaryType = 'arraybuffer';

    // If the socket never opens (e.g. an old server without /api/stt), fail
    // over to the browser's live Web Speech engine instead of silently never
    // transcribing — and never fall back to the old upload-based recorder.
    const openTimer = window.setTimeout(() => {
      if (this.ws === ws && ws.readyState !== WebSocket.OPEN) {
        this.isListening = false;
        this.ws = null;
        try {
          ws.close();
        } catch {
          // ignore
        }
        this.emit('error', { error: 'stt_unavailable' });
      }
    }, 6000);

    ws.onopen = () => {
      clearTimeout(openTimer);
      this.reconnectAttempts = 0;
      void this.startCapture();
    };

    ws.onmessage = (e) => this.handleMessage(e.data);

    ws.onclose = () => {
      clearTimeout(openTimer);
      if (this.ws === ws) this.ws = null;
      this.stopCapture();
      if (this.isListening) {
        if (this.reconnectAttempts >= 6) {
          this.isListening = false;
          this.emit('error', { error: 'stt_unavailable' });
        } else {
          this.scheduleReconnect();
        }
      }
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        // ignore
      }
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null || !this.isListening) return;
    const delay = Math.min(4000, 500 * Math.pow(2, this.reconnectAttempts));
    this.reconnectAttempts += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.isListening && !this.ws) this.connect();
    }, delay);
  }

  private async startCapture(): Promise<void> {
    if (this.ctx || !this.ws) return;
    const stream = this.config.stream;
    if (!stream) {
      console.warn('[STT] no microphone stream available for streaming');
      this.emit('error', { error: 'no_microphone_stream' });
      return;
    }
    try {
      const w = window as Window & { webkitAudioContext?: typeof AudioContext };
      const Ctor = window.AudioContext || w.webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      this.ctx = ctx;

      const source = ctx.createMediaStreamSource(stream);

      // Preferred: AudioWorklet — no deprecation warning and much lower
      // capture latency than ScriptProcessor.
      try {
        await ctx.audioWorklet.addModule(PCM_WORKLET_URL);
        const node = new AudioWorkletNode(ctx, 'ksemo-pcm');
        node.port.onmessage = (e) => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(e.data);
          }
        };
        source.connect(node);
        node.connect(ctx.destination);
        this.workletNode = node;
      } catch {
        console.warn('[STT] AudioWorklet unavailable; using ScriptProcessor');
        // Fallback: ScriptProcessor (deprecated but universal). Must connect
        // to something to fire; a zero-gain node keeps it running without
        // routing the live mic to the speakers.
        const gain = ctx.createGain();
        gain.gain.value = 0;
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        this.processor = processor;
        processor.onaudioprocess = (e) => {
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
          const input = e.inputBuffer.getChannelData(0);
          this.ws.send(downsampleToPcm16(input, ctx.sampleRate));
        };
        source.connect(processor);
        processor.connect(gain);
        gain.connect(ctx.destination);
      }

      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch (err) {
      console.error('Streaming capture failed:', err);
      this.emit('error', { error: 'recorder_failed' });
    }
  }

  private stopCapture(): void {
    if (this.workletNode) {
      try {
        this.workletNode.port.close();
        this.workletNode.disconnect();
      } catch {
        // ignore
      }
      this.workletNode = null;
    }
    if (this.processor) {
      try {
        this.processor.disconnect();
      } catch {
        // ignore
      }
      this.processor = null;
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        this.ctx.close();
      } catch {
        // ignore
      }
    }
    this.ctx = null;
  }

  private handleMessage(data: unknown): void {
    if (typeof data !== 'string') return;
    let msg: DeepgramLiveMessage;
    try {
      msg = JSON.parse(data) as DeepgramLiveMessage;
    } catch {
      return;
    }
    const alt = msg.channel?.alternatives?.[0];
    if (!alt || typeof alt.transcript !== 'string') return;
    const text = alt.transcript.trim();
    if (!text) return;
    this.emit('transcript', {
      text,
      isFinal: msg.is_final === true,
      confidence: typeof alt.confidence === 'number' ? alt.confidence : 1,
      timestamp: Date.now(),
    } as TranscriptEvent);
  }

  // Streaming STT delivers finals on its own near real time, so there is
  // nothing to flush on VAD silence.
  flushPending(): void {
    // no-op
  }

  stop(): void {
    this.isListening = false;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopCapture();
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.emit('end', {});
  }

  abort(): void {
    this.stop();
  }

  isSupported(): boolean {
    return typeof WebSocket !== 'undefined'
      && typeof window !== 'undefined'
      && typeof window.AudioContext !== 'undefined'
      && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
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
      listeners.forEach((listener) => listener(event));
    }
  }
}
