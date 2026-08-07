import { TranscriptEvent, RecognitionConfig, VoiceEvent, STTProvider } from './types';

// Speech-to-text via MediaRecorder + the server's /api/transcribe endpoint
// (Deepgram). The API key lives only in server.cjs and never reaches the
// browser. Mic audio is captured with MediaRecorder (supported in every
// modern browser) and the recorded blob is POSTed to /api/transcribe as
// base64.
//
// Transcription is triggered by:
//   • VAD silence in hands-free mode  → VoiceEngine calls flushPending()
//   • push-to-talk release            → stop() flushes the captured audio

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

function pickSupportedMime(): string {
  if (typeof MediaRecorder !== 'undefined') {
    for (const c of MIME_CANDIDATES) {
      try {
        if (MediaRecorder.isTypeSupported(c)) return c;
      } catch {
        // ignore
      }
    }
  }
  return 'audio/webm';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export class MediaRecorderSTT implements STTProvider {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private isListening = false;
  private flushing = false;
  private stopping = false;
  private config: Partial<RecognitionConfig> = {};
  private mimeType = pickSupportedMime();
  private tokenCounter = 0;
  // Consecutive transcription attempts that produced nothing. When this
  // climbs too high (Deepgram rejects the audio or the endpoint is missing),
  // the engine falls back to the browser's built-in Web Speech recognition.
  private emptyFlushes = 0;
  private eventListeners: Map<string, Set<(event: VoiceEvent) => void>> = new Map();

  getProviderId(): 'mediarecorder' {
    return 'mediarecorder';
  }

  private getToken(): number {
    return this.tokenCounter;
  }

  private bumpToken(): void {
    this.tokenCounter++;
  }

  start(config?: Partial<RecognitionConfig>): void {
    if (!this.isListening) {
      this.isListening = true;
      this.stopping = false;
      this.emit('started', {});
      this.emit('state_change', { state: 'listening' });
    }
    if (config) this.config = { ...this.config, ...config };
    if (!this.flushing && (!this.recorder || this.recorder.state === 'inactive')) {
      this.beginRecording();
    }
  }

  stop(): void {
    // Push-to-talk release: flush the audio captured so far, then stop.
    this.stopping = true;
    if (this.recorder && this.recorder.state === 'recording' && this.chunks.length > 0) {
      this.flushPending();
    } else {
      this.isListening = false;
      this.bumpToken();
      this.recorder = null;
      this.chunks = [];
      this.emit('end', {});
    }
  }

  abort(): void {
    this.isListening = false;
    this.stopping = true;
    this.bumpToken();
    if (this.recorder && this.recorder.state !== 'inactive') {
      try {
        this.recorder.stop();
      } catch {
        // ignore
      }
    }
    this.recorder = null;
    this.chunks = [];
    this.emit('end', {});
  }

  flushPending(): void {
    if (!this.isListening || this.flushing) return;
    const rec = this.recorder;
    if (!rec || rec.state !== 'recording') {
      console.warn('[STT] flush skipped: recorder', rec ? rec.state : 'null');
      return;
    }
    if (this.chunks.length === 0) {
      console.warn('[STT] flush skipped: no chunks');
      return;
    }

    // Ignore tiny segments (e.g. only the WebM init header or a burst of
    // noise). Sending those to Deepgram yields "corrupt or unsupported data"
    // 400s and loses the user's actual speech.
    const totalBytes = this.chunks.reduce((a, c) => a + c.size, 0);
    console.log('[STT] flushing', this.chunks.length, 'chunks,', totalBytes, 'bytes');
    if (totalBytes < 2048) {
      console.warn('[STT] segment too small, skipping');
      this.chunks = [];
      this.emptyFlushes += 1;
      this.maybeFallback();
      return;
    }

    this.flushing = true;
    const token = this.getToken();
    const recRef = rec;

    // stop() fires a final dataavailable then stop; collect everything.
    recRef.onstop = () => {
      const blob = new Blob(this.chunks, { type: recRef.mimeType || this.mimeType });
      this.chunks = [];
      // Restart capture immediately so no speech is lost while the previous
      // segment is being transcribed.
      if (this.isListening && !this.stopping) this.beginRecording();
      this.finishFlush(blob, token);
    };
    recRef.stop();
  }

  private async finishFlush(blob: Blob, token: number): Promise<void> {
    try {
      if (blob.size > 0) {
        const text = await this.transcribe(blob);
        console.log('[STT] transcribe result:', JSON.stringify(text).slice(0, 120));
        if (token === this.getToken() && text.trim()) {
          this.emptyFlushes = 0;
          this.emit('transcript', {
            text,
            isFinal: true,
            confidence: 1,
            timestamp: Date.now(),
          } as TranscriptEvent);
        } else {
          this.emptyFlushes += 1;
          this.maybeFallback();
        }
      }
    } catch (err) {
      console.error('STT flush error:', err);
    } finally {
      this.flushing = false;
      if (this.stopping) {
        this.isListening = false;
        this.bumpToken();
        this.recorder = null;
        this.chunks = [];
        this.emit('end', {});
      }
    }
  }

  // After enough silent/lost transcriptions, tell the engine to swap to the
  // browser's built-in Web Speech recognition so voice keeps working even if
  // the server endpoint is missing or the recorded audio is rejected.
  private maybeFallback(): void {
    if (this.emptyFlushes >= 3) {
      this.emptyFlushes = 0;
      this.emit('error', { error: 'stt_unavailable' });
    }
  }

  private beginRecording(): void {
    if (!this.isListening || this.stopping) return;
    const stream = this.config.stream ?? null;
    if (!stream) {
      console.warn('[STT] no microphone stream available');
      this.emit('error', { error: 'no_microphone_stream' });
      return;
    }
    try {
      // Always build a fresh MediaRecorder per segment. Reusing a stopped
      // recorder can emit headerless/incomplete WebM that Deepgram rejects.
      this.recorder = new MediaRecorder(stream, this.mimeType ? { mimeType: this.mimeType } : undefined);
      console.log('[STT] recorder started, mime:', this.recorder.mimeType || this.mimeType);
      this.recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.chunks.push(e.data);
      };
      this.recorder.start(250);
    } catch (err) {
      console.error('MediaRecorder start failed:', err);
      this.emit('error', { error: 'recorder_failed' });
    }
  }

  private async transcribe(blob: Blob): Promise<string> {
    try {
      const audio = await blobToBase64(blob);
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio, mime: blob.type || this.mimeType, language: this.config.language }),
      });
      // A static-only host (or an unconfigured server) can return HTML here;
      // parse JSON defensively and degrade to an empty transcript.
      let data: { error?: string; text?: string } = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      if (!res.ok) {
        // Only trigger the fatal 'stt_unavailable' state if the server explicitly reports
        // that the STT service is not configured (e.g. missing API key).
        const isConfigError = res.status === 400 && typeof data?.error === 'string' && data.error.includes('No STT provider configured');
        if (isConfigError) {
          this.emit('error', { error: 'stt_unavailable' });
        } else {
          console.warn('Transcribe request warning (transient):', res.status, data?.error || '');
        }
        return data?.text ?? '';
      }
      console.log('[STT] server response ok, text:', JSON.stringify(data?.text ?? '').slice(0, 120));
      return typeof data?.text === 'string' ? data.text : '';
    } catch (err) {
      console.error('Transcribe request failed:', err);
      this.emit('error', { error: 'stt_unavailable' });
      return '';
    }
  }

  isSupported(): boolean {
    return typeof MediaRecorder !== 'undefined'
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

  private emit(type: string, data: any): void {
    const event: VoiceEvent = {
      type: type as any,
      data,
      timestamp: Date.now(),
    };
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.forEach((listener) => listener(event));
    }
  }
}
