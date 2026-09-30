// Distinct Web Audio sound engines for Dictate vs Bot Voice Mode.
let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// -------------------------------------------------------------------------
// 1. DICTATE SOUNDS (Microphone in Chat: crisp, tactile, haptic click/plink)
// -------------------------------------------------------------------------

function dictateClick(
  context: AudioContext,
  frequency: number,
  startAt: number,
  duration = 0.045
) {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(frequency, startAt);
  osc.frequency.exponentialRampToValueAtTime(
    Math.max(100, frequency * 0.4),
    startAt + duration
  );

  gain.gain.setValueAtTime(0.001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gain).connect(context.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.01);
}

/** Dictate Start: crisp, tactile double-pop click */
export function playRecordingStart() {
  const context = audioContext();
  if (!context) return;
  const now = context.currentTime + 0.005;
  dictateClick(context, 1200, now, 0.035);
  dictateClick(context, 1900, now + 0.05, 0.04);
}

/** Dictate Stop: soft closing single tap */
export function playRecordingStop() {
  const context = audioContext();
  if (!context) return;
  const now = context.currentTime + 0.005;
  dictateClick(context, 900, now, 0.04);
}

/** Dictate Cancel: low muted blip */
export function playRecordingCancel() {
  const context = audioContext();
  if (!context) return;
  const now = context.currentTime + 0.005;
  dictateClick(context, 400, now, 0.06);
}

// -------------------------------------------------------------------------
// 2. BOT VOICE CHAT SOUNDS (Hands-free AI: warm acoustic Rhodes/marimba chime)
// -------------------------------------------------------------------------

function warmMarimbaTone(
  context: AudioContext,
  frequency: number,
  startAt: number,
  duration = 0.28,
  volume = 0.2
) {
  // Fundamental warm tone
  const osc1 = context.createOscillator();
  const gain1 = context.createGain();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(frequency, startAt);

  // Soft natural acoustic attack (12ms) and smooth exponential decay
  gain1.gain.setValueAtTime(0.0001, startAt);
  gain1.gain.exponentialRampToValueAtTime(volume, startAt + 0.012);
  gain1.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  // Warm 2nd harmonic for organic acoustic body
  const osc2 = context.createOscillator();
  const gain2 = context.createGain();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(frequency * 2, startAt);

  gain2.gain.setValueAtTime(0.0001, startAt);
  gain2.gain.exponentialRampToValueAtTime(volume * 0.22, startAt + 0.008);
  gain2.gain.exponentialRampToValueAtTime(0.0001, startAt + duration * 0.6);

  // Lowpass filter for velvety warm acoustic character without harshness
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(frequency * 3.5, startAt);

  osc1.connect(gain1).connect(filter);
  osc2.connect(gain2).connect(filter);
  filter.connect(context.destination);

  osc1.start(startAt);
  osc2.start(startAt);
  osc1.stop(startAt + duration + 0.05);
  osc2.stop(startAt + duration + 0.05);
}

/** Bot Voice Start: silky-smooth, warm acoustic chime (C5 523Hz -> G5 784Hz) */
export function playBotVoiceStart() {
  const context = audioContext();
  if (!context) return;
  const now = context.currentTime + 0.005;
  warmMarimbaTone(context, 523.25, now, 0.24, 0.18);
  warmMarimbaTone(context, 783.99, now + 0.09, 0.32, 0.22);
}

/** Bot Voice Stop: gentle descending warm tone (G5 784Hz -> C5 523Hz) */
export function playBotVoiceStop() {
  const context = audioContext();
  if (!context) return;
  const now = context.currentTime + 0.005;
  warmMarimbaTone(context, 783.99, now, 0.2, 0.18);
  warmMarimbaTone(context, 523.25, now + 0.08, 0.28, 0.16);
}

/** Bot Voice Cancel: soft gentle low tap */
export function playBotVoiceCancel() {
  const context = audioContext();
  if (!context) return;
  const now = context.currentTime + 0.005;
  warmMarimbaTone(context, 440, now, 0.2, 0.14);
}
