const TARGET_FRAMES = 2048;

class DeepgramAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(TARGET_FRAMES);
    this.size = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      for (let i = 0; i < channel.length; i++) {
        this.buffer[this.size++] = channel[i];
        if (this.size >= TARGET_FRAMES) {
          this.port.postMessage(this.buffer.slice());
          this.size = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor('deepgram-audio-processor', DeepgramAudioProcessor);
