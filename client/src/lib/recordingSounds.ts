// Soft UI sounds for voice recording feedback, synthesized with Web Audio.
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

function tone(
  context: AudioContext,
  from: number,
  to: number,
  startAt: number,
  duration: number
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(from, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(to, startAt + duration);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.14, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.05);
}

function chime(notes: Array<[number, number]>, noteDuration = 0.09) {
  const context = audioContext();
  if (!context) return;
  const now = context.currentTime + 0.01;
  notes.forEach(([frequency, offset], index) =>
    tone(
      context,
      frequency,
      frequency * (index === notes.length - 1 ? 1 : 1.02),
      now + offset * noteDuration,
      noteDuration
    )
  );
}

export function playRecordingStart() {
  chime([
    [660, 0],
    [880, 1],
  ]);
}

export function playRecordingStop() {
  chime([
    [880, 0],
    [587, 1],
  ]);
}

export function playRecordingCancel() {
  chime([[392, 0]], 0.16);
}

export function playVoiceChatStart() {
  chime([
    [523, 0],
    [659, 1],
    [784, 2],
  ], 0.1);
}

export function playVoiceChatStop() {
  chime([
    [784, 0],
    [659, 1],
    [523, 2],
  ], 0.1);
}
