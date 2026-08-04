import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Layers, Shield, ChevronDown,
  Menu, X, Search, Zap, Brain,
  Check, ArrowUpRight, Mic, AudioLines, Settings, LogOut,
  Sparkles, Volume2, AudioWaveform, ShieldCheck, Download, Trash2,
  Cpu, FileDown,
} from 'lucide-react';
import { Button } from '../components/ui';
import { cn } from '../lib/utils';
import { useAuthContext } from '../components/AuthProvider';
import { getStoredVoiceId, pickVoice } from '../lib/voices';

/* ──────────────────── data ──────────────────── */

const faqs = [
  { q: 'What is Ksemo?', a: 'Ksemo is an AI voice chat. Instead of typing, you talk to your AI and it answers out loud — with live subtitles. Every conversation is saved to your Recent list.' },
  { q: 'How do I start a conversation?', a: 'Open Voice Chat and press Start — or, in hands-free mode, simply say "start" or "begin". You can also wake Ksemo with "Hey KSEMO", or hold Space in push-to-talk mode.' },
  { q: 'Does it work offline?', a: 'Ksemo runs in your browser. When no API key is configured or the network drops, a built-in local engine keeps producing responses — so the app is always usable.' },
  { q: 'Which AI powers Ksemo?', a: 'Ksemo runs on Google\u2019s Gemini API for fast, high-quality spoken answers, with a local fallback engine when the network isn\u2019t available.' },
  { q: 'Is Ksemo free?', a: 'Yes. There are no plans, no billing, and no upgrade prompts — it\u2019s simply free. You can export or delete your data anytime from Settings.' },
  { q: 'Is my data private?', a: 'Every table uses row-level security, so you can only ever access your own data. You can export or delete your data at any time from Settings.' },
  { q: 'Can I share a conversation?', a: 'Yes. From any chat you can copy a private link, create a public link for anyone with the URL, or email the link to someone directly.' },
];

const privacyPoints = [
  { icon: ShieldCheck, title: 'Row-level security', desc: 'Every table in the database is locked to your account. No one else can ever see your chats.' },
  { icon: Download, title: 'Export your data', desc: 'Download everything — chats, messages, settings — as a single JSON file, anytime.' },
  { icon: Trash2, title: 'Delete anything', desc: 'Remove one message, one chat, all chats, or your entire account. One click and it\u2019s gone.' },
  { icon: Cpu, title: 'Offline-ready engine', desc: 'A built-in local engine keeps answers coming even when the network drops.' },
];

const bento = [
  { icon: AudioWaveform, span: 'md:col-span-3', number: '01', title: 'Control it with your voice', desc: 'Start with "start", end with "hang up", and wake Ksemo with "Hey KSEMO". Speak mid-answer and Ksemo stops to listen.', chips: ['“Hey KSEMO”', '“start”', '“hang up”', '“goodbye”'] },
  { icon: Brain, span: 'md:col-span-3', number: '02', title: 'Replies that match your mood', desc: 'Ksemo reads your tone — happy, excited, calm, and more — and adjusts how it speaks back in real time.', chips: ['10 emotions', 'Tone-adjusted voice'], wave: true },
  { icon: AudioLines, span: 'md:col-span-2', number: '03', title: 'Live subtitles', desc: 'Every spoken answer appears word-by-word on screen. Follow along, or mute the voice and read instead.' },
  { icon: Volume2, span: 'md:col-span-2', number: '04', title: 'Pick your voice', desc: 'Choose from a curated top-5 of natural voices, or let Auto pick the best one. Preview instantly.' },
  { icon: Search, span: 'md:col-span-2', number: '05', title: 'Search everything', desc: 'Find any session by title or by the words inside its messages — with tabs for chats and messages.' },
  { icon: FileDown, span: 'md:col-span-3', number: '06', title: 'Export & share', desc: 'Save a chat as PDF, Word, or plain text. Share a private link, a public link, or send it straight to an inbox.', chips: ['PDF', 'Word', 'Text', 'Link', 'Email'] },
  { icon: Layers, span: 'md:col-span-3', number: '07', title: 'Stay organized', desc: 'Every session lands in Recent with a mic icon. Rename, pin, archive, or filter by date — pick up any talk later.', chips: ['Rename', 'Pin', 'Archive', 'Date filters'] },
];

const emotions = ['Happy', 'Excited', 'Calm', 'Friendly', 'Professional', 'Neutral', 'Nervous', 'Confused', 'Sad', 'Angry'];

/* ──────────────────── Demo voice conversation ──────────────────── */

const demoLines = [
  { label: 'Greeting', text: "Hi, I'm Ksemo, your AI voice assistant. How can I help you today?" },
  { label: 'Interrupt', text: "Sorry — go ahead, I'm listening." },
];

const demoRecentChats = [
  { title: 'Hi, I’m Ksemo' },
  { title: 'Getting started' },
];

/* ──────────────────── Wobbly circle (mirrors the real VoiceChat canvas renderer) ──────────────────── */

function WobblyCircle({ className, phase = 'idle', minRadius = 110 }: { className?: string; phase?: 'idle' | 'listening' | 'thinking' | 'speaking'; minRadius?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;
    let time = 0;

    const render = () => {
      time += 1;

      let level = 0.02 + Math.abs(Math.sin(time * 0.03)) * 0.03;
      if (phase === 'thinking') {
        level = 0.01 + Math.abs(Math.sin(time * 0.08)) * 0.03;
      } else if (phase === 'speaking') {
        const sim = 0.05 + Math.abs(Math.sin(time * 0.14) * Math.cos(time * 0.06)) * 0.38;
        const isPause = Math.sin(time * 0.035) < -0.65;
        level = isPause ? 0.01 : sim;
      }

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.clearRect(0, 0, w, h);

      let baseRadius = Math.min(w, h) * 0.38;
      if (baseRadius < minRadius) baseRadius = minRadius;

      const numPoints = 120;
      ctx.beginPath();
      for (let i = 0; i <= numPoints; i++) {
        const theta = (i / numPoints) * Math.PI * 2;
        const w1 = Math.sin(theta * 4 + time * 0.04) * 5;
        const w2 = Math.cos(theta * 7 - time * 0.1) * (3 + level * 28);
        const w3 = Math.sin(theta * 13 + time * 0.07) * (1.5 + level * 14);
        const r = baseRadius + w1 + w2 + w3;
        const x = w / 2 + Math.cos(theta) * r;
        const y = h / 2 + Math.sin(theta) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = '#000000';
      ctx.fill();

      animFrame = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animFrame);
  }, [phase, minRadius]);

  return <canvas ref={ref} className={className} />;
}

/* ──────────────────── Animated voice demo (mirrors the real app UI, actually speaks) ──────────────────── */

function VoiceDemo() {
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [spoken, setSpoken] = useState('');
  const [view, setView] = useState<'voice' | 'search'>('voice');
  const [accountOpen, setAccountOpen] = useState(false);
  const [demoQuery, setDemoQuery] = useState('');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startedRef = useRef(started);

  useEffect(() => { startedRef.current = started; }, [started]);

  // ── Barge-in (interrupt) ──────────────────────────────────────────────────
  // Mirrors the real app's VoiceEngine: while Ksemo is speaking, a lightweight
  // VAD watches the mic. If the user talks over it for ~300ms, TTS stops at
  // once and Ksemo acknowledges the interruption out loud. No buttons involved.
  const aliveRef = useRef(true);
  const activeLineRef = useRef(0);
  const bargeInArmedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const vadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopInterruptMonitoring = useCallback(() => {
    if (vadTimerRef.current !== null) {
      clearInterval(vadTimerRef.current);
      vadTimerRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch { /* ok */ }
      audioCtxRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
  }, []);

  const finishDemo = useCallback(() => {
    setStarted(false);
    setPhase('idle');
    setSpoken('');
    bargeInArmedRef.current = false;
    stopInterruptMonitoring();
    try { window.speechSynthesis.cancel(); } catch { /* ok */ }
  }, [stopInterruptMonitoring]);

  // React to the user talking over Ksemo: stop speaking, then acknowledge.
  const interruptRef = useRef<() => void>(() => {});
  useEffect(() => {
    interruptRef.current = () => {
      if (!bargeInArmedRef.current) return;
      bargeInArmedRef.current = false;
      stopInterruptMonitoring();
      try { window.speechSynthesis.cancel(); } catch { /* ok */ }
      speakLine(1);
    };
  });

  // Watch the mic (frequency-level VAD, same threshold as the real engine) so
  // the user can interrupt mid-speech just by talking over Ksemo.
  const startInterruptMonitoring = useCallback(() => {
    stopInterruptMonitoring();
    if (!startedRef.current) return;
    const webkitCtx = (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const AudioCtx = window.AudioContext || webkitCtx;
    if (!AudioCtx || !navigator.mediaDevices?.getUserMedia) return;

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        if (!aliveRef.current || !startedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const ctx = new AudioCtx();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        audioCtxRef.current = ctx;
        micStreamRef.current = stream;

        const data = new Uint8Array(analyser.frequencyBinCount);
        let speechMs = 0;
        vadTimerRef.current = setInterval(() => {
          if (!bargeInArmedRef.current || !startedRef.current) return;
          analyser.getByteFrequencyData(data);
          const sum = data.reduce((a, b) => a + b, 0);
          const level = sum / data.length / 255;
          if (level > 0.3) {
            speechMs += 50;
            if (speechMs >= 300) {
              speechMs = 0;
              interruptRef.current();
            }
          } else {
            speechMs = 0;
          }
        }, 50);
      })
      .catch(() => { /* mic denied — barge-in just stays off */ });
  }, [stopInterruptMonitoring]);

  // Speak a line out loud (real TTS) with live word-by-word subtitles
  const speakLine = useCallback((lineIdx: number) => {
    if (!startedRef.current) return;

    const l = demoLines[lineIdx % demoLines.length];
    activeLineRef.current = lineIdx;
    setPhase('speaking');
    setSpoken('');

    // Only the greeting is interruptible, so the acknowledgment plays cleanly.
    if (lineIdx === 0) {
      bargeInArmedRef.current = true;
      startInterruptMonitoring();
    } else {
      bargeInArmedRef.current = false;
    }

    const words = l.text.split(/\s+/).filter(Boolean);
    let wordTimer: ReturnType<typeof setInterval> | null = null;
    const stopWordTimer = () => { if (wordTimer) { clearInterval(wordTimer); wordTimer = null; } };

    if (!('speechSynthesis' in window)) {
      const myLine = lineIdx;
      words.forEach((_, wi) => {
        timers.current.push(setTimeout(() => {
          if (activeLineRef.current !== myLine) return;
          setSpoken(words.slice(0, wi + 1).join(' '));
        }, wi * 140));
      });
      timers.current.push(setTimeout(() => {
        if (activeLineRef.current !== myLine) return;
        finishDemo();
      }, words.length * 140 + 500));
      return;
    }

    try { window.speechSynthesis.cancel(); } catch { /* ok */ }

    // Word-by-word subtitle reveal on a timer (same approach as the real app),
    // so subtitles stream in live while the voice speaks. Word-boundary events
    // are unreliable across browsers and previously only showed words after speech.
    if (words.length) {
      const revealMs = Math.max(2500, words.length * 360);
      const perWordMs = Math.max(100, revealMs / words.length);
      let index = 0;
      setSpoken(words[0]);
      wordTimer = setInterval(() => {
        index += 1;
        setSpoken(words.slice(0, index).join(' '));
        if (index >= words.length) stopWordTimer();
      }, perWordMs);
    }

    const u = new SpeechSynthesisUtterance(l.text);
    u.rate = 0.95;
    u.pitch = 0.85;
    u.volume = 1;

    const v = pickVoice(getStoredVoiceId(), window.speechSynthesis.getVoices());
    if (v) u.voice = v;

    u.onend = () => {
      stopWordTimer();
      if (activeLineRef.current !== lineIdx) return; // superseded by a barge-in
      setSpoken(l.text);
      timers.current.push(setTimeout(finishDemo, 1200));
    };

    u.onerror = () => {
      stopWordTimer();
      if (activeLineRef.current !== lineIdx) return; // superseded by a barge-in
      timers.current.push(setTimeout(finishDemo, 500));
    };

    window.speechSynthesis.speak(u);
  }, [finishDemo, startInterruptMonitoring]);

  // Cleanup on unmount
  useEffect(() => () => {
    aliveRef.current = false;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    stopInterruptMonitoring();
    try { window.speechSynthesis.cancel(); } catch { /* ok */ }
  }, [stopInterruptMonitoring]);

  const startDemo = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    setStarted(true);
    setPhase('speaking');
    speakLine(0);
  }, [speakLine]);

  return (
    <div className="relative max-w-5xl mx-auto">
      {/* ambient glow behind the card */}
      <div className="absolute -inset-8 bg-gradient-to-tr from-white/[0.05] via-transparent to-white/[0.03] blur-[90px] rounded-full pointer-events-none" />

      <div className="relative rounded-2xl border border-white/10 bg-ink-900 overflow-hidden shadow-lift">
        {/* top highlight line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        {/* corner glows */}
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/[0.05] blur-[90px] pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-white/[0.04] blur-[90px] pointer-events-none" />

        {/* App mockup: sidebar + main workspace */}
        <div className="relative flex flex-col md:flex-row min-h-[500px]">

          {/* Sidebar */}
          <div className="hidden md:flex w-[240px] shrink-0 border-r border-white/8 bg-ink-950 flex-col">
            {/* logo + project name */}
            <div className="h-14 px-4 flex items-center gap-2 border-b border-white/8 shrink-0">
              <img src="/KSEMOlogo.png" alt="KSEMO" className="h-7 w-7 rounded-lg object-contain" />
              <span className="text-[14px] font-semibold tracking-tight text-white/90">Ksemo</span>
            </div>

            {/* nav */}
            <div className="px-2 pt-3 space-y-0.5 shrink-0">
              <button
                onClick={() => { setView('voice'); setAccountOpen(false); }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-[12px] text-left transition',
                  view === 'voice' ? 'bg-white/8 text-white' : 'text-ink-200 hover:bg-white/5 hover:text-white',
                )}
              >
                <Mic size={14} className="shrink-0" /> Voice Chat
              </button>
              <button
                onClick={() => { setView('search'); setAccountOpen(false); }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-[12px] text-left transition',
                  view === 'search' ? 'bg-white/8 text-white' : 'text-ink-200 hover:bg-white/5 hover:text-white',
                )}
              >
                <Search size={14} className="shrink-0" /> Search
              </button>
            </div>

            {/* recent chats */}
            <div className="px-3 pt-4">
              <div className="text-[10px] uppercase tracking-wider text-ink-300 px-2 mb-1">Recent</div>
              <div className="space-y-0.5">
                {demoRecentChats.map((c) => (
                  <button
                    key={c.title}
                    onClick={() => { setView('voice'); setAccountOpen(false); startDemo(); }}
                    className="w-full flex items-center gap-2 px-2.5 h-8 rounded-lg text-ink-200 text-[12px] hover:bg-white/5 hover:text-white transition"
                  >
                    <Mic size={13} className="text-ink-300 shrink-0" />
                    <span className="truncate">{c.title}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1" />

            {/* footer / account menu */}
            <div className="relative border-t border-white/8 p-2 shrink-0">
              <button
                onClick={() => setAccountOpen((v) => !v)}
                className="w-full flex items-center gap-2.5 px-2.5 h-10 rounded-lg hover:bg-white/5 transition"
              >
                <div className="h-6 w-6 rounded-full bg-ink-700 border border-white/10 flex items-center justify-center text-[9px] font-semibold text-white shrink-0">KS</div>
                <div className="leading-tight min-w-0 text-left">
                  <div className="text-white truncate text-[12px]">K. S</div>
                  <div className="text-[9px] text-ink-400">Free Account</div>
                </div>
              </button>
              {accountOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setAccountOpen(false)} />
                  <div className="absolute bottom-full left-2 mb-1 z-40 w-[190px] rounded-xl bg-ink-900 border border-white/10 p-1 shadow-2xl animate-in fade-in duration-100">
                    <button
                      onClick={() => setAccountOpen(false)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-ink-100 hover:bg-white/5 hover:text-white transition text-left"
                    >
                      <Settings size={13} className="text-ink-300" /> Settings
                    </button>
                    <button
                      onClick={() => setAccountOpen(false)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-red-400 hover:bg-red-500/10 hover:text-red-300 transition text-left"
                    >
                      <LogOut size={13} /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Main workspace */}
          <div className="flex-1 min-w-0 flex flex-col items-center px-4 sm:px-8 pt-5 pb-8">

            {/* mobile logo bar */}
            <div className="md:hidden w-full flex items-center gap-2 pb-5">
              <img src="/KSEMOlogo.png" alt="KSEMO" className="h-7 w-7 rounded-lg object-contain" />
              <span className="text-[14px] font-semibold tracking-tight text-white/90">Ksemo</span>
            </div>

            {/* content */}
            <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center">
              {view === 'search' ? (
                <div className="w-full max-w-md text-center animate-fade-in">
                  <div className="relative mb-4">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300 shrink-0" />
                    <input
                      value={demoQuery}
                      onChange={(e) => setDemoQuery(e.target.value)}
                      placeholder="Search all, chat, message…"
                      autoFocus
                      className="w-full h-9 pl-9 pr-3 rounded-xl bg-ink-850 border border-white/10 text-ink-100 text-[12px] placeholder:text-ink-400 outline-none focus:border-white/20 transition"
                    />
                  </div>
                  <p className="text-[12px] text-ink-300 mb-6">Search all chats and messages</p>
                  <div className="space-y-2 text-left">
                    {demoRecentChats
                      .filter((c) => c.title.toLowerCase().includes(demoQuery.trim().toLowerCase()))
                      .map((c) => (
                        <button
                          key={c.title}
                          onClick={() => { setView('voice'); setDemoQuery(''); startDemo(); }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-ink-850 border border-white/8 text-ink-200 text-[12px] hover:border-white/15 transition"
                        >
                          <Mic size={14} className="text-ink-300 shrink-0" />
                          <span className="truncate">{c.title}</span>
                        </button>
                      ))}
                  </div>
                  {demoRecentChats.filter((c) => c.title.toLowerCase().includes(demoQuery.trim().toLowerCase())).length === 0 && (
                    <p className="text-[12px] text-ink-400 py-8">
                      No results for “{demoQuery}”
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {/* core wobbly orb — mirrors the real Voice Chat circle */}
                  <div className="relative w-64 h-64 sm:w-72 sm:h-72">
                    <WobblyCircle
                      phase={started ? phase : 'idle'}
                      minRadius={100}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* live subtitles (shown while the greeting plays) */}
                  {started && (
                    <div className="mt-6 text-center animate-fade-in max-w-md px-4 min-h-[24px]">
                      <p className="text-sm font-medium leading-relaxed text-ink-100 transition-all duration-300">{spoken}</p>
                    </div>
                  )}

                  {/* single start control — after the greeting it returns here */}
                  <div className="z-20 py-2 h-14 flex items-center justify-center">
                    {!started ? (
                      <button
                        onClick={startDemo}
                        className="px-8 h-12 rounded-full border border-white/10 bg-ink-800 text-white hover:bg-ink-700 active:scale-95 transition-all shadow-glow font-semibold tracking-wide text-[13px]"
                      >
                        Start Voice Chat
                      </button>
                    ) : (
                      <div className="h-12 flex items-center">
                        <span className="text-[11px] uppercase tracking-widest text-ink-300 animate-pulse-soft">Speaking…</span>
                      </div>
                    )}
                  </div>

                  {started && (
                    <p className="mt-1 text-[11px] text-ink-400 animate-fade-in">
                      While Ksemo is speaking, just say something — it stops and listens.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────── Voice visual (used in CTA) ──────────────────── */

function VoiceVisual() {
  return (
    <div className="relative mb-6 inline-flex flex-col items-center">
      <div className="relative h-28 w-28">
        <div className="absolute -inset-4 rounded-full bg-white/[0.04] blur-xl" />
        <WobblyCircle phase="listening" minRadius={40} className="w-full h-full object-contain" />
      </div>
    </div>
  );
}

/* ──────────────────── Small presentational helpers ──────────────────── */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/[0.04] text-[12px] font-medium tracking-wide text-ink-100 animate-fade-in">
      {children}
    </div>
  );
}

function SectionHeader({ eyebrow, title, desc }: { eyebrow: React.ReactNode; title: string; desc?: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-14">
      <div className="flex justify-center"><Eyebrow>{eyebrow}</Eyebrow></div>
      <h2 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight text-balance animate-slide-up">{title}</h2>
      {desc && <p className="mt-4 text-ink-200 text-balance animate-slide-up" style={{ animationDelay: '60ms' }}>{desc}</p>}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/8 bg-white/[0.03] text-[12px] text-ink-200">
      <Check size={11} className="text-white/60" /> {children}
    </span>
  );
}

/* ──────────────────── Main landing ──────────────────── */

export default function Landing() {
  const { profile } = useAuthContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { href: '#demo', label: 'Live demo' },
    { href: '#features', label: 'Features' },
    { href: '#how', label: 'How it works' },
    { href: '#faq', label: 'FAQ' },
  ];

  return (
    <div className="min-h-screen bg-ink-900 text-white grain overflow-x-hidden">
      {/* ── Nav ── */}
      <header className={cn('fixed top-0 inset-x-0 z-50 transition-all duration-300', scrolled ? 'glass-strong border-b border-white/8' : 'border-b border-transparent')}>
        <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <img src="/KSEMOlogo.png" alt="KSEMO" className="h-8 w-8 rounded-xl object-contain" />
            <span className="text-[17px] font-semibold tracking-tight">Ksemo</span>
          </Link>

          <div className="hidden md:flex items-center gap-1 text-sm text-ink-200">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="px-3 py-1.5 rounded-lg hover:bg-white/5 hover:text-white transition">{l.label}</a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-2 shrink-0">
            {profile ? (
              <Link to="/app"><Button size="sm">Open Voice Chat <ArrowRight size={14} /></Button></Link>
            ) : (
              <>
                <Link to="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
                <Link to="/signup"><Button size="sm">Get started <ArrowRight size={14} /></Button></Link>
              </>
            )}
          </div>

          <button className="md:hidden h-9 w-9 rounded-lg flex items-center justify-center hover:bg-white/5 transition" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </nav>

        {menuOpen && (
          <div className="md:hidden glass-strong border-t border-white/8 px-6 py-4 flex flex-col gap-1 animate-slide-down">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)} className="text-sm text-ink-100 py-2 rounded-lg hover:bg-white/5">{l.label}</a>
            ))}
            {profile ? (
              <Link to="/app" className="w-full mt-2" onClick={() => setMenuOpen(false)}><Button size="sm" className="w-full">Open Voice Chat</Button></Link>
            ) : (
              <div className="flex gap-2 mt-2">
                <Link to="/login" className="flex-1" onClick={() => setMenuOpen(false)}><Button variant="outline" size="sm" className="w-full">Sign in</Button></Link>
                <Link to="/signup" className="flex-1" onClick={() => setMenuOpen(false)}><Button size="sm" className="w-full">Get started</Button></Link>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section className="relative pt-36 pb-14 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[560px] w-[900px] bg-white/[0.04] blur-[160px] rounded-full" />
          <div className="absolute top-1/4 -left-32 h-80 w-80 bg-white/[0.025] blur-[120px] rounded-full animate-float" />
          <div className="absolute top-1/3 -right-32 h-80 w-80 bg-white/[0.02] blur-[120px] rounded-full animate-float-delay" />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          <div className="flex justify-center mb-7 animate-fade-in">
            <Eyebrow>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/50 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
              </span>
              Voice-first AI assistant · Free, no plans
            </Eyebrow>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-semibold tracking-tight leading-[1.02] text-balance animate-slide-up">
            Talk to your AI.{' '}
            <span className="bg-gradient-to-b from-white via-white/85 to-white/35 bg-clip-text text-transparent">Out loud.</span>
          </h1>

          <p className="mt-6 text-lg text-ink-200 max-w-2xl mx-auto text-balance animate-slide-up" style={{ animationDelay: '60ms' }}>
            Ksemo listens, thinks, and answers in natural speech — with live subtitles,
            emotion-aware replies, and every conversation saved to Recent.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3 animate-slide-up" style={{ animationDelay: '120ms' }}>
            {profile ? (
              <Link to="/app"><Button size="lg">Open Voice Chat <ArrowRight size={16} /></Button></Link>
            ) : (
              <Link to="/signup"><Button size="lg">Try it free <ArrowRight size={16} /></Button></Link>
            )}
            <a href="#demo"><Button variant="outline" size="lg">Hear it speak</Button></a>
          </div>

          <p className="mt-4 text-[12px] text-ink-300 animate-fade-in" style={{ animationDelay: '180ms' }}>
            No credit card required · No plans · Works in your browser
          </p>

        </div>
      </section>
      <section id="demo" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <SectionHeader
            eyebrow={<><AudioWaveform size={13} /> Live preview — it actually speaks</>}
            title="Hear Ksemo in action"
            desc="Real voice conversations — press start and Ksemo greets you out loud, with the same wobbly orb and sidebar you get in the app. Just speak mid-sentence and Ksemo stops to listen."
          />
          <div className="relative">
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 h-40 w-96 bg-white/[0.04] blur-[90px] rounded-full pointer-events-none" aria-hidden />
            <VoiceDemo />
          </div>
        </div>
      </section>

      {/* ── Features bento ── */}
      <section id="features" className="py-24 px-6 border-t border-white/8">
        <div className="max-w-6xl mx-auto">
          <SectionHeader
            eyebrow={<><Zap size={13} /> Features</>}
            title="Built around your voice"
            desc="Not a bag of bolted-on tools — one focused voice chat that handles the whole conversation."
          />

          <div className="grid md:grid-cols-6 gap-4">
            {bento.map((f, i) => (
              <div
                key={f.title}
                className={cn(
                  'group relative rounded-3xl border border-white/8 bg-ink-850 p-7 overflow-hidden transition-all duration-300 hover:border-white/20 hover:shadow-lift animate-slide-up',
                  f.span,
                )}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-white/[0.05] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <div className="relative flex items-start justify-between mb-6">
                  <div className="h-11 w-11 rounded-xl bg-gradient-to-b from-white/10 to-white/[0.02] border border-white/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <f.icon size={20} className="text-white" />
                  </div>
                  <span className="text-[12px] font-mono text-ink-400 select-none">{f.number}</span>
                </div>
                <h3 className="text-[17px] font-semibold text-white mb-1.5">{f.title}</h3>
                <p className="text-sm text-ink-300 leading-relaxed">{f.desc}</p>

                {f.wave && (
                  <div className="c-voice-waves text-white/40 mt-6" aria-hidden>
                    <span className="c-voice-wave" /><span className="c-voice-wave" /><span className="c-voice-wave" /><span className="c-voice-wave" /><span className="c-voice-wave" />
                  </div>
                )}

                {f.chips && (
                  <div className="flex flex-wrap gap-2 mt-6">
                    {f.chips.map((c) => (
                      <Chip key={c}>{c}</Chip>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* emotions strip */}
          <div className="mt-4 rounded-3xl border border-white/8 bg-ink-850 p-7 sm:p-8 overflow-hidden animate-slide-up" style={{ animationDelay: '360ms' }}>
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="shrink-0">
                <div className="text-[12px] uppercase tracking-wider text-ink-400 mb-2">Emotion engine</div>
                <h3 className="text-lg font-semibold text-white">Ksemo feels how you feel</h3>
                <p className="text-sm text-ink-300 mt-1 max-w-sm">Ten emotions, detected live from your voice — each one nudges how Ksemo speaks back.</p>
              </div>
              <div className="flex flex-wrap gap-2 md:ml-auto md:justify-end">
                {emotions.map((e) => (
                  <span key={e} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/8 bg-white/[0.03] text-[12px] text-ink-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/50" /> {e}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── From thought to answer (steps) ── */}
      <section id="how" className="py-24 px-6 border-t border-white/8">
        <div className="max-w-6xl mx-auto">
          <SectionHeader
            eyebrow={<><Volume2 size={13} /> How it works</>}
            title="From thought to spoken answer in seconds"
            desc="No setup. No typing. Just talk."
          />
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { n: '01', icon: Mic, title: 'Press start — or just say "start"', desc: 'Open Voice Chat and the mic goes live. In hands-free mode, a spoken command gets you going instantly.' },
              { n: '02', icon: AudioLines, title: 'Speak, and Ksemo answers out loud', desc: 'Your words go to Gemini and the reply streams back sentence by sentence — spoken, with subtitles on screen.' },
              { n: '03', icon: Layers, title: 'Pick it back up in Recent', desc: 'Every session is saved with a mic icon. Search, rename, pin, archive, share, or export it anytime.' },
            ].map((item, i) => (
              <div key={item.n} className="relative rounded-3xl border border-white/8 bg-ink-850 p-7 hover:border-white/20 hover:shadow-lift transition-all duration-300 animate-slide-up" style={{ animationDelay: `${i * 70}ms` }}>
                <span className="absolute top-6 right-6 text-[56px] font-bold text-white/[0.04] leading-none select-none">{item.n}</span>
                <div className="relative">
                  <div className="h-11 w-11 rounded-xl bg-gradient-to-b from-white/10 to-white/[0.02] border border-white/10 flex items-center justify-center mb-6">
                    <item.icon size={20} className="text-white" />
                  </div>
                  <h3 className="text-[17px] font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-ink-300 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Privacy ── */}
      <section className="py-24 px-6 border-t border-white/8">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-[28px] p-px bg-gradient-to-b from-white/15 via-white/6 to-transparent">
            <div className="relative rounded-[27px] bg-ink-850 px-6 py-14 md:p-14 overflow-hidden">
              <div className="absolute inset-0 pointer-events-none" aria-hidden>
                <div className="absolute -top-24 -left-24 h-64 w-64 bg-white/[0.04] blur-[90px] rounded-full animate-float" />
              </div>
              <div className="relative">
                <div className="text-center mb-12">
                  <div className="flex justify-center"><Eyebrow><><Shield size={13} /> Private by design</></Eyebrow></div>
                  <h2 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight text-balance">Your conversations are yours</h2>
                  <p className="mt-4 text-ink-200 max-w-2xl mx-auto">Ksemo was built private-first — your chats are locked to your account and always under your control.</p>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {privacyPoints.map((p, i) => (
                    <div key={p.title} className="rounded-2xl border border-white/8 bg-ink-900/60 p-6 hover:border-white/15 transition-all duration-300 animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-b from-white/10 to-white/[0.02] border border-white/10 flex items-center justify-center mb-4">
                        <p.icon size={18} className="text-white" />
                      </div>
                      <h3 className="text-[15px] font-semibold text-white mb-1.5">{p.title}</h3>
                      <p className="text-[13px] text-ink-300 leading-relaxed">{p.desc}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-8 text-center text-[12px] text-ink-400">
                  Built on Google’s Gemini API · Row-level security on every table · Runs in your browser
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-24 px-6 border-t border-white/8">
        <div className="max-w-3xl mx-auto">
          <SectionHeader
            eyebrow={<><Sparkles size={13} /> FAQ</>}
            title="Questions, answered"
          />
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-2xl border transition-all duration-300 animate-slide-up',
                  openFaq === i ? 'border-white/15 bg-ink-850 shadow-lift' : 'border-white/8 bg-ink-850/50 hover:border-white/12',
                )}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 sm:px-6 text-left"
                >
                  <span className="text-[15px] font-medium text-white">{f.q}</span>
                  <span className={cn('h-7 w-7 shrink-0 rounded-lg border border-white/10 bg-white/[0.03] flex items-center justify-center transition-transform duration-300', openFaq === i && 'rotate-180')}>
                    <ChevronDown size={15} className="text-ink-200" />
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-5 sm:px-6 pb-5 text-[14px] text-ink-200 leading-relaxed animate-slide-down border-t border-white/8 pt-4 -mt-px">
                    {f.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-[28px] p-px bg-gradient-to-b from-white/20 via-white/10 to-transparent">
            <div className="relative rounded-[27px] bg-ink-850 px-6 py-14 md:p-16 text-center overflow-hidden">
              <div className="absolute inset-0 pointer-events-none" aria-hidden>
                <div className="absolute -top-20 -right-20 h-64 w-64 bg-white/[0.04] blur-[90px] rounded-full animate-float" />
                <div className="absolute -bottom-20 -left-20 h-64 w-64 bg-white/[0.025] blur-[90px] rounded-full animate-float-delay" />
              </div>
              <div className="relative">
                <div className="relative mb-6 inline-flex">
                  <span className="absolute -inset-3 rounded-full bg-white/[0.05] blur-2xl animate-pulse-ring" aria-hidden />
                  <VoiceVisual />
                </div>
                <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-balance">Start talking to your AI today</h2>
                <p className="mt-4 text-ink-200 max-w-lg mx-auto">Free. No plans, no billing, no credit card. Just open Voice Chat and say the word.</p>
                <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
                  {profile ? (
                    <Link to="/app"><Button size="lg">Open Voice Chat <ArrowRight size={16} /></Button></Link>
                  ) : (
                    <>
                      <Link to="/signup"><Button size="lg">Start free <ArrowRight size={16} /></Button></Link>
                      <Link to="/login"><Button variant="outline" size="lg">Sign in</Button></Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/8 py-14 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10 mb-10">
            <div className="md:col-span-2">
              <Link to="/" className="flex items-center gap-2.5 mb-4">
                <img src="/KSEMOlogo.png" alt="KSEMO" className="h-8 w-8 rounded-xl object-contain" />
                <span className="text-[16px] font-semibold text-white tracking-tight">Ksemo</span>
              </Link>
              <p className="text-[13px] text-ink-300 max-w-sm leading-relaxed">An AI voice chat for people who think for a living. Talk, search, and revisit — all in one focused environment.</p>
              <div className="flex flex-wrap gap-2 mt-5">
                {(['Voice-first', 'Private by design', 'Works offline']).map((t) => (
                  <Chip key={t}>{t}</Chip>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[12px] font-semibold text-white uppercase tracking-wider mb-4">Product</div>
              <div className="space-y-2.5">
                <a href="#demo" className="block text-[13px] text-ink-300 hover:text-white transition">Live demo</a>
                <a href="#features" className="block text-[13px] text-ink-300 hover:text-white transition">Features</a>
                <a href="#how" className="block text-[13px] text-ink-300 hover:text-white transition">How it works</a>
                <a href="#faq" className="block text-[13px] text-ink-300 hover:text-white transition">FAQ</a>
              </div>
            </div>
            <div>
              <div className="text-[12px] font-semibold text-white uppercase tracking-wider mb-4">Account</div>
              <div className="space-y-2.5">
                {profile ? (
                  <Link to="/app" className="block text-[13px] text-ink-300 hover:text-white transition">Voice Chat</Link>
                ) : (
                  <>
                    <Link to="/login" className="block text-[13px] text-ink-300 hover:text-white transition">Sign in</Link>
                    <Link to="/signup" className="block text-[13px] text-ink-300 hover:text-white transition">Sign up</Link>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="border-t border-white/8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[12px] text-ink-300">© 2026 Ksemo. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <Link to="/privacy" className="text-[12px] text-ink-300 hover:text-white transition flex items-center gap-1">Privacy <ArrowUpRight size={10} /></Link>
              <Link to="/terms" className="text-[12px] text-ink-300 hover:text-white transition flex items-center gap-1">Terms <ArrowUpRight size={10} /></Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
