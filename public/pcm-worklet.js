// AudioWorklet processor for streaming STT.
//
// Runs off the main thread: captures mono Float32 mic frames, resamples to
// 16kHz, converts to 16-bit PCM, and posts each chunk to the main thread,
// which forwards it to the Deepgram streaming endpoint over WebSocket.
//
// `AudioWorkletProcessor`, `registerProcessor`, and `sampleRate` are globals
// injected by the browser's AudioWorkletGlobalScope — this file is never
// executed as a normal script.
//
// Lives in public/ (not src/) on purpose: audioWorklet.addModule() needs a
// real URL, and Vite's ?url import of a small JS file inlines it as a base64
// data: URL, which browsers reject for worklet modules. public/* is served
// verbatim at /pcm-worklet.js in dev and copied to dist/ in production.

const TARGET_RATE = 16000;

function clamp16(v) {
  const s = Math.max(-1, Math.min(1, v));
  return s < 0 ? (s * 0x8000) | 0 : (s * 0x7fff) | 0;
}

class KsemoPcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.fromRate = sampleRate;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const data = input[0];
    let pcm;

    if (this.fromRate === TARGET_RATE) {
      pcm = new Int16Array(data.length);
      for (let i = 0; i < data.length; i++) pcm[i] = clamp16(data[i]);
    } else {
      const ratio = this.fromRate / TARGET_RATE;
      const len = Math.max(1, Math.floor(data.length / ratio));
      pcm = new Int16Array(len);
      for (let i = 0; i < len; i++) {
        const idx = i * ratio;
        const i0 = Math.floor(idx);
        const frac = idx - i0;
        const s0 = data[i0];
        const s1 = data[Math.min(i0 + 1, data.length - 1)];
        pcm[i] = clamp16(s0 + (s1 - s0) * frac);
      }
    }

    this.port.postMessage(pcm, [pcm.buffer]);
    return true;
  }
}

registerProcessor('ksemo-pcm', KsemoPcmProcessor);
