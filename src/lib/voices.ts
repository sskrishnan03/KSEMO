export interface DetectedVoice {
  id: string;
  label: string;
  lang: string;
  gender: 'female' | 'male' | 'unknown';
  neural: boolean;
  localService: boolean;
  voice: SpeechSynthesisVoice;
}

export const VOICE_STORAGE_KEY = 'ksemo_voice_id';
export const DEFAULT_VOICE_ID = 'auto';

export const VOICE_PREVIEW_TEXT = "Hey, I'm Ksemo — this is my voice.";

const FEMALE_RE = /aria|jenny|zira|samantha|karen|moira|tessa|michelle|natasha|susan|hazel|charlotte|emma|olivia|ava|google us english|google uk english female|google english india|indian english|हिन्दी|female/i;
const MALE_RE = /guy|david|mark|daniel|christopher|alex|fred|james|thomas|ryan|eric|michael|brian|george|oliver|jack|mason|google uk english male|male/i;
const NEURAL_RE = /natural|online|neural|enhanced|premium/i;

export function getStoredVoiceId(): string {
  try {
    return localStorage.getItem(VOICE_STORAGE_KEY) ?? DEFAULT_VOICE_ID;
  } catch { /* ignore */ }
  return DEFAULT_VOICE_ID;
}

export function setStoredVoiceId(id: string): void {
  try { localStorage.setItem(VOICE_STORAGE_KEY, id); } catch { /* ignore */ }
}

// Browser voices load asynchronously; wait for them so we never fall back to a
// broken default voice.
export async function loadVoices(timeoutMs = 2000): Promise<SpeechSynthesisVoice[]> {
  if (!('speechSynthesis' in window)) return [];
  let voices = window.speechSynthesis.getVoices();
  if (voices.length) return voices;

  return new Promise<SpeechSynthesisVoice[]>((resolve) => {
    let settled = false;
    const grab = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length && !settled) { settled = true; resolve(v); }
    };
    window.speechSynthesis.addEventListener('voiceschanged', grab);
    setTimeout(() => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.removeEventListener('voiceschanged', grab);
      resolve(window.speechSynthesis.getVoices());
    }, timeoutMs);
    grab();
  });
}

export function prettyName(name: string): string {
  return name
    .replace(/\s*-\s*English\s*(\([^)]*\))?$/i, '')
    .replace(/Online \(Natural\)/gi, 'Natural')
    .replace(/\(Natural\)/gi, 'Natural')
    .replace(/\s+/g, ' ')
    .trim();
}

function guessGender(v: SpeechSynthesisVoice): DetectedVoice['gender'] {
  if (FEMALE_RE.test(v.name)) return 'female';
  if (MALE_RE.test(v.name)) return 'male';
  return 'unknown';
}

// Pick up to `count` DISTINCT real voices from this device, ranking the most
// human-sounding ones first and keeping a male/female mix so each choice
// genuinely sounds different.
export function detectVoices(voices: SpeechSynthesisVoice[], count = 5): DetectedVoice[] {
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const score = (v: SpeechSynthesisVoice): number => {
    let s = 0;
    if (NEURAL_RE.test(v.name)) s += 100;
    if (v.lang === 'en-US' || v.lang === 'en-GB' || v.lang === 'en-IN') s += 5;
    return s;
  };

  const ranked = en.slice().sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
  const picked: DetectedVoice[] = [];
  const seen = new Set<string>();
  const maxSame = Math.ceil(count / 2);
  const counts = { female: 0, male: 0 };

  const push = (v: SpeechSynthesisVoice) => {
    const id = `${v.name}|${v.lang}`;
    if (seen.has(id)) return;
    seen.add(id);
    const g = guessGender(v);
    picked.push({
      id,
      label: prettyName(v.name),
      lang: v.lang,
      gender: g,
      neural: NEURAL_RE.test(v.name),
      localService: v.localService,
      voice: v,
    });
    if (g === 'female' || g === 'male') counts[g]++;
  };

  // Pass 1: best voices, capped so no single gender dominates.
  for (const v of ranked) {
    if (picked.length >= count) break;
    const g = guessGender(v);
    if (g !== 'unknown' && counts[g] >= maxSame) continue;
    push(v);
  }
  // Pass 2: fill any remaining slots.
  for (const v of ranked) {
    if (picked.length >= count) break;
    push(v);
  }

  return picked;
}

// Resolve a stored voice id (or 'auto') to a real voice.
export function pickVoice(storedId: string | undefined, voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const id = storedId && storedId !== DEFAULT_VOICE_ID ? storedId.trim() : '';
  if (id) {
    const exact = voices.find((v) => `${v.name}|${v.lang}` === id)
      ?? voices.find((v) => v.name === id);
    if (exact) return exact;
  }
  return pickSmartVoice(voices);
}

function pickSmartVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const enVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const local = enVoices.filter((v) => v.localService);
  const candidates = local.length ? local : enVoices;

  return candidates.find((v) => /natural|online|neural|enhanced|aria|jenny|guy|christopher/i.test(v.name))
    || candidates.find((v) => /daniel|alex|james|matthew|thomas|google.*male|google.*gb|en-gb.*male|en-in/i.test(v.name))
    || candidates.find((v) => /david|mark|richard|google.*english|samantha|en-us/i.test(v.name))
    || candidates[0]
    || null;
}
