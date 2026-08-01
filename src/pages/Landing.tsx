import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Layers, Shield, ChevronDown,
  Menu, X, Search, Zap, Brain,
  Lock, Check, ArrowUpRight, Mic, MicOff, AudioLines,
} from 'lucide-react';
import { Button } from '../components/ui';
import { cn } from '../lib/utils';
import { useAuthContext } from '../components/AuthProvider';

/* ──────────────────── data ──────────────────── */

const features = [
  { icon: Mic, title: 'Voice-first conversations', desc: 'Just talk. Ksemo listens, thinks, and answers out loud — a natural hands-free back-and-forth with no typing at all.' },
  { icon: AudioLines, title: 'Spoken answers, live subtitles', desc: 'Every reply is spoken word-by-word with real-time subtitles on screen. Mute anytime, or follow along in text.' },
  { icon: Shield, title: 'Private by design', desc: 'Row-level security on every table, encrypted sessions, and your voice data never leaves your workspace.' },
  { icon: Search, title: 'Search every session', desc: 'All your voice conversations are saved. Full-text search finds any past talk instantly.' },
  { icon: Layers, title: 'Saved in Recent with a mic icon', desc: 'Every session lands in your Recent list with a mic icon. Reopen any conversation and keep talking from where you left off.' },
  { icon: Brain, title: 'Multi-model support', desc: 'Each voice session can use the best AI model for the job — coding, writing, or analysis — all spoken back to you.' },
];

const faqs = [
  { q: 'What is Ksemo?', a: 'Ksemo is a voice-first AI workspace. Instead of typing, you talk to your AI and it talks back — while every conversation is saved to your Recent list for later.' },
  { q: 'Is my data private?', a: 'Every table uses row-level security so you can only ever access your own data. Sessions are encrypted, and you can export or delete your data at any time from Settings.' },
  { q: 'Does it work offline?', a: 'Ksemo runs in the browser. The local engine produces responses even when no backend is connected, so the app is always usable.' },
  { q: 'Which AI models are supported?', a: 'Ksemo connects to leading AI providers including OpenAI, Anthropic, Google, and open-source models via OpenRouter. You can switch models per voice session.' },
  { q: 'Can I cancel anytime?', a: 'Yes. Plans are month-to-month and you can cancel or downgrade from Settings at any time. Your data stays yours.' },
  { q: 'How is this different from ChatGPT?', a: 'Ksemo is voice-first. You speak naturally and Ksemo answers out loud — no chat window to manage. Every talk is saved with a mic icon in Recent so you can pick it back up anytime.' },
];

/* ──────────────────── Demo voice conversation ──────────────────── */

const demoLines = [
  { label: 'Morning briefing', text: 'Good morning! Here is your briefing — three meetings today, and your top priority is the product demo at 2 p.m.' },
  { label: 'Poetry', text: 'The ocean breathes in silver light, where stars dissolve into the deep.' },
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
  const [idx, setIdx] = useState(0);
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [spoken, setSpoken] = useState('');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mutedRef = useRef(muted);
  const startedRef = useRef(started);

  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { startedRef.current = started; }, [started]);

  // Speak a demo sentence out loud (real TTS) with live word-by-word subtitles
  const speakLine = useCallback((lineIdx: number) => {
    if (!startedRef.current) return;

    if (mutedRef.current) {
      setSpoken('');
      setPhase('listening');
      timers.current.push(setTimeout(() => {
        if (startedRef.current) setIdx((p) => (p + 1) % demoLines.length);
      }, 1800));
      return;
    }

    const l = demoLines[lineIdx % demoLines.length];
    setPhase('speaking');
    setSpoken('');

    if (!('speechSynthesis' in window)) {
      const words = l.text.split(' ');
      words.forEach((_, wi) => {
        timers.current.push(setTimeout(() => setSpoken(words.slice(0, wi + 1).join(' ')), wi * 140));
      });
      timers.current.push(setTimeout(() => {
        if (!startedRef.current) return;
        setPhase('listening');
        setSpoken('');
        timers.current.push(setTimeout(() => {
          if (startedRef.current) setIdx((p) => (p + 1) % demoLines.length);
        }, 1800));
      }, words.length * 140 + 400));
      return;
    }

    try { window.speechSynthesis.cancel(); } catch { /* ok */ }

    const u = new SpeechSynthesisUtterance(l.text);
    u.rate = 0.95;
    u.pitch = 0.85;
    u.volume = 1;

    u.onboundary = (e: SpeechSynthesisEvent) => {
      if (e.name !== 'word') return;
      const rest = l.text.slice(e.charIndex);
      const sp = rest.search(/\s/);
      const end = sp === -1 ? l.text.length : e.charIndex + sp;
      setSpoken(l.text.slice(0, end));
    };

    u.onend = () => {
      if (!startedRef.current) return;
      setSpoken(l.text);
      setPhase('listening');
      timers.current.push(setTimeout(() => {
        if (startedRef.current) setIdx((p) => (p + 1) % demoLines.length);
      }, 2000));
    };

    u.onerror = () => {
      if (!startedRef.current) return;
      setPhase('listening');
      timers.current.push(setTimeout(() => {
        if (startedRef.current) setIdx((p) => (p + 1) % demoLines.length);
      }, 1500));
    };

    window.speechSynthesis.speak(u);
  }, []);

  // Cycle: listen → think → speak, advancing through the demo lines
  useEffect(() => {
    if (!started || mutedRef.current) return;
    setPhase('listening');
    setSpoken('');
    timers.current.push(setTimeout(() => {
      if (!startedRef.current || mutedRef.current) return;
      setPhase('thinking');
      setSpoken('');
      timers.current.push(setTimeout(() => speakLine(idx), 1100));
    }, 1400));
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [idx, started, speakLine]);

  // Cleanup on unmount
  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    try { window.speechSynthesis.cancel(); } catch { /* ok */ }
  }, []);

  const startDemo = useCallback(() => {
    if (started) return;
    setStarted(true);
    setPhase('listening');
  }, [started]);

  const endDemo = useCallback(() => {
    setStarted(false);
    setPhase('idle');
    setSpoken('');
    try { window.speechSynthesis.cancel(); } catch { /* ok */ }
  }, []);

  const toggleMute = useCallback(() => {
    if (muted) {
      setMuted(false);
      timers.current.push(setTimeout(() => {
        if (!startedRef.current) return;
        setPhase('thinking');
        setSpoken('');
        timers.current.push(setTimeout(() => speakLine(idx), 1100));
      }, 400));
    } else {
      setMuted(true);
      try { window.speechSynthesis.cancel(); } catch { /* ok */ }
      setPhase('listening');
      setSpoken('');
      timers.current.push(setTimeout(() => {
        if (startedRef.current) setIdx((p) => (p + 1) % demoLines.length);
      }, 1800));
    }
  }, [muted, idx, speakLine]);

  return (
    <div className="relative max-w-4xl mx-auto">
      {/* ambient glow behind the card */}
      <div className="absolute -inset-8 bg-gradient-to-tr from-white/[0.05] via-transparent to-white/[0.03] blur-[90px] rounded-full pointer-events-none" />

      <div className="relative rounded-[2rem] border border-white/10 bg-ink-900 overflow-hidden shadow-lift">
        {/* top highlight line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        {/* corner glows */}
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/[0.05] blur-[90px] pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-white/[0.04] blur-[90px] pointer-events-none" />

        <div className="relative flex flex-col items-center px-6 sm:px-10 pt-10 pb-8">

          {/* live badge */}
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-ink-300 mb-10">
            <span className={cn('h-1.5 w-1.5 rounded-full', started ? 'bg-emerald-400 animate-pulse-soft' : 'bg-ink-500')} />
            {started ? 'Live conversation' : 'Live demo — press start'}
          </div>

          {/* orb stage */}
          <div className="relative flex items-center justify-center w-full">

            {/* floating feature chips */}
            <div className="hidden lg:flex absolute left-0 top-1/4 items-center gap-2 px-3.5 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur text-[12px] text-ink-200 animate-slide-up">
              <Mic size={13} className="text-white/80" /> Speak naturally
            </div>
            <div className="hidden lg:flex absolute right-0 top-1/2 items-center gap-2 px-3.5 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur text-[12px] text-ink-200 animate-slide-up" style={{ animationDelay: '80ms' }}>
              <Zap size={13} className="text-white/80" /> Instant answers
            </div>
            <div className="hidden lg:flex absolute left-10 bottom-2 items-center gap-2 px-3.5 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur text-[12px] text-ink-200 animate-slide-up" style={{ animationDelay: '160ms' }}>
              <Layers size={13} className="text-white/80" /> Saved in Recent
            </div>

            {/* rotating conic ring */}
            <div
              className="absolute h-80 w-80 sm:h-96 sm:w-96 rounded-full animate-spin opacity-50"
              style={{
                background: 'conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.22) 50deg, transparent 110deg, transparent 180deg, rgba(255,255,255,0.14) 240deg, transparent 300deg)',
                animationDuration: '26s',
              }}
            />
            {/* halo ring that swells when speaking */}
            <div className={cn(
              'absolute h-60 w-60 sm:h-72 sm:w-72 rounded-full border border-white/10 transition-all duration-700',
              started && phase === 'speaking' && 'scale-110 border-white/25',
            )} />
            {/* soft glow under the orb */}
            <div className="absolute h-52 w-52 sm:h-64 sm:w-64 rounded-full bg-white/[0.06] blur-3xl" />

            {/* core wobbly orb */}
            <div className="relative h-44 w-44 sm:h-56 sm:w-56">
              <WobblyCircle
                phase={started ? phase : 'idle'}
                minRadius={56}
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* status + subtitle */}
          <div className="mt-10 text-center max-w-xl min-h-[48px]">
            {!started ? (
              <p className="text-[13px] text-ink-300 leading-relaxed">
                Tap <span className="text-white font-medium">Start Voice Chat</span> — Ksemo listens, thinks, and answers out loud.
              </p>
            ) : phase === 'speaking' ? (
              <p className="text-base sm:text-lg font-medium leading-relaxed text-white">{spoken}</p>
            ) : phase === 'thinking' ? (
              <p className="text-xs font-semibold tracking-widest text-ink-300 uppercase animate-pulse-soft">Thinking…</p>
            ) : (
              <p className="text-xs font-semibold tracking-widest text-ink-300 uppercase animate-pulse-soft">Listening…</p>
            )}
          </div>

          {/* controls */}
          <div className="mt-8">
            {!started ? (
              <button
                onClick={startDemo}
                className="px-10 h-14 rounded-full bg-white text-ink-900 font-semibold text-[14px] tracking-wide shadow-lift hover:bg-white/90 active:scale-95 transition-all"
              >
                <span className="flex items-center gap-2.5">
                  <Mic size={17} />
                  Start Voice Chat
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-5 animate-scale-in">
                <button
                  onClick={endDemo}
                  className="w-14 h-14 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 active:scale-95 text-white flex items-center justify-center transition-all shadow-soft"
                  aria-label="End session"
                  title="End session"
                >
                  <X size={20} />
                </button>

                <div className="flex items-center gap-4 h-16 px-6 rounded-full border border-white/10 bg-ink-800/90 shadow-glow">
                  <div className={cn('c-voice-waves', phase === 'speaking' ? 'text-white' : 'text-white/40')} style={{ transform: 'scale(1.5)' }}>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <span key={i} className="c-voice-wave" style={{ height: `${4 + (i % 5) * 3}px`, animationDelay: `${i * 0.06}s` }} />
                    ))}
                  </div>
                  <span className="w-px h-8 bg-white/10" />
                  <button
                    onClick={toggleMute}
                    className={cn(
                      'h-11 w-11 rounded-full flex items-center justify-center transition-all active:scale-95',
                      muted ? 'bg-ink-700 text-white' : 'bg-white/10 text-white hover:bg-white/15',
                    )}
                    aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
                    title={muted ? 'Unmute' : 'Mute'}
                  >
                    {muted ? <MicOff size={19} /> : <Mic size={19} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* decorative bottom waveform */}
        <div className="relative h-12 opacity-30 pointer-events-none flex items-end justify-center gap-[3px] px-8">
          {Array.from({ length: 48 }).map((_, i) => (
            <span
              key={i}
              className="w-[3px] rounded-full bg-white"
              style={{ height: `${6 + Math.abs(Math.sin(i * 0.32)) * 18}px` }}
            />
          ))}
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

/* ──────────────────── Main landing ──────────────────── */

export default function Landing() {
  const { profile } = useAuthContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-ink-900 text-white grain">
      {/* ── Nav ── */}
      <header className={cn('fixed top-0 inset-x-0 z-50 transition-all duration-300', scrolled ? 'glass-strong border-b border-white/8' : 'border-b border-transparent')}>
        <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/KSEMOlogo.png" alt="KSEMO" className="h-8 w-8 rounded-xl object-contain" />
            <span className="text-[17px] font-semibold tracking-tight">Ksemo</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-ink-200">
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#faq" className="hover:text-white transition">FAQ</a>
          </div>
          <div className="hidden md:flex items-center gap-2">
            {profile ? (
              <div className="flex items-center gap-4">
                <span className="text-[13px] text-ink-300 font-medium">Hello, {profile.full_name || profile.username}</span>
                <Link to="/app"><Button size="sm">Go to Workspace <ArrowRight size={14} /></Button></Link>
              </div>
            ) : (
              <>
                <Link to="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
                <Link to="/signup"><Button size="sm">Get started <ArrowRight size={14} /></Button></Link>
              </>
            )}
          </div>
          <button className="md:hidden h-9 w-9 rounded-lg flex items-center justify-center hover:bg-white/5" onClick={() => setMenuOpen((v) => !v)}>
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </nav>
        {menuOpen && (
          <div className="md:hidden glass-strong border-t border-white/8 px-6 py-4 flex flex-col gap-3 animate-slide-down">
            <a href="#features" onClick={() => setMenuOpen(false)} className="text-sm text-ink-100 py-1">Features</a>
            <a href="#faq" onClick={() => setMenuOpen(false)} className="text-sm text-ink-100 py-1">FAQ</a>
            {profile ? (
              <div className="flex flex-col gap-2 pt-2">
                <span className="text-[13px] text-ink-300 font-medium text-center mb-1">Hello, {profile.full_name || profile.username}</span>
                <Link to="/app" className="w-full" onClick={() => setMenuOpen(false)}><Button size="sm" className="w-full">Go to Workspace</Button></Link>
              </div>
            ) : (
              <div className="flex gap-2 pt-2">
                <Link to="/login" className="flex-1" onClick={() => setMenuOpen(false)}><Button variant="outline" size="sm" className="w-full">Sign in</Button></Link>
                <Link to="/signup" className="flex-1" onClick={() => setMenuOpen(false)}><Button size="sm" className="w-full">Get started</Button></Link>
              </div>
            )}
          </div>
        )}
      </header>


      {/* ── Hero ── */}
      <section className="relative pt-36 pb-20 px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[500px] w-[800px] bg-white/[0.03] blur-[150px] rounded-full" />
        </div>
        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-[12px] text-ink-100 mb-6 animate-fade-in">
            <Mic size={13} /> A voice-first AI workspace
          </div>
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05] text-balance animate-slide-up">
            Your AI voice workspace.
          </h1>
          <p className="mt-6 text-lg text-ink-200 max-w-2xl mx-auto text-balance animate-slide-up" style={{ animationDelay: '60ms' }}>
            Ksemo listens, thinks, and answers out loud. Just talk —
            every conversation is saved to Recent so you can pick it up anytime.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 animate-slide-up" style={{ animationDelay: '120ms' }}>
            {profile ? (
              <Link to="/app"><Button size="lg">Go to Workspace <ArrowRight size={16} /></Button></Link>
            ) : (
              <Link to="/signup"><Button size="lg">Start free <ArrowRight size={16} /></Button></Link>
            )}
            <a href="#demo"><Button variant="outline" size="lg">Hear it in action</Button></a>
          </div>
          <p className="mt-4 text-[12px] text-ink-300 animate-fade-in">No credit card required · Free voice sessions daily</p>
        </div>
      </section>


      {/* ── Live Voice Demo ── */}
      <section id="demo" className="py-16 px-6">
        <div className="max-w-5xl mx-auto text-center mb-10">
          <div className="text-[12px] uppercase tracking-wider text-ink-300 mb-3">Live preview</div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">Hear Ksemo in action</h2>
          <p className="mt-4 text-ink-200 max-w-xl mx-auto">Real voice conversations — talk out loud and get natural, spoken answers, saved to Recent as you go.</p>
        </div>
        <VoiceDemo />
      </section>


      {/* ── Features ── */}
      <section id="features" className="py-24 px-6 border-t border-white/8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="text-[12px] uppercase tracking-wider text-ink-300 mb-3">Features</div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">Everything you need for voice-first AI</h2>
            <p className="mt-4 text-ink-200">One calm, focused voice workspace — not a bag of features bolted together.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <div key={f.title} className="group rounded-2xl bg-ink-850 border border-white/8 p-6 hover:border-white/15 hover:shadow-lift transition-all duration-300 animate-slide-up" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="h-11 w-11 rounded-xl bg-ink-800 border border-white/10 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <f.icon size={20} className="text-white" />
                </div>
                <h3 className="text-[16px] font-semibold text-white mb-1.5">{f.title}</h3>
                <p className="text-sm text-ink-300 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ── How it works ── */}
      <section className="py-24 px-6 border-t border-white/8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="text-[12px] uppercase tracking-wider text-ink-300 mb-3">How it works</div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">From thought to spoken answer in seconds</h2>
            <p className="mt-4 text-ink-200">Three steps. No setup. No typing.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', icon: Mic, title: 'Start a voice session', desc: 'Open Voice Chat and press start. Ksemo begins listening instantly — just speak naturally.' },
              { step: '02', icon: AudioLines, title: 'Get spoken answers', desc: 'Responses stream as natural speech with live subtitles. Mute anytime or follow along on screen.' },
              { step: '03', icon: Layers, title: 'Saved in Recent', desc: 'Every session lands in Recent with a mic icon. Reopen any conversation and keep talking later.' },
            ].map((item, i) => (
              <div key={item.step} className="relative animate-slide-up" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="text-[64px] font-bold text-white/[0.04] absolute -top-8 -left-2 leading-none select-none">{item.step}</div>
                <div className="relative pt-8">
                  <div className="h-12 w-12 rounded-2xl bg-ink-800 border border-white/10 flex items-center justify-center mb-5">
                    <item.icon size={22} className="text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-ink-300 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ── Bento highlight ── */}
      <section className="py-24 px-6 border-t border-white/8">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-ink-850 border border-white/8 p-8 animate-slide-up">
              <div className="h-11 w-11 rounded-xl bg-ink-800 border border-white/10 flex items-center justify-center mb-5">
                <Lock size={20} className="text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Private by default</h3>
              <p className="text-sm text-ink-300 leading-relaxed mb-6">Every voice conversation is encrypted. Row-level security means even database admins can't see your data. Export or delete everything from Settings at any time.</p>
              <div className="flex flex-wrap gap-2">
                {['RLS on every table', 'Encrypted sessions', 'Full data export'].map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/8 text-[12px] text-ink-200">
                    <Check size={11} className="text-white/60" /> {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-ink-850 border border-white/8 p-8 animate-slide-up" style={{ animationDelay: '60ms' }}>
              <div className="h-11 w-11 rounded-xl bg-ink-800 border border-white/10 flex items-center justify-center mb-5">
                <Zap size={20} className="text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Built for speed</h3>
              <p className="text-sm text-ink-300 leading-relaxed mb-6">Spoken responses stream in real time — no waiting for a full block of text. Start hearing the answer immediately.</p>
              <div className="flex flex-wrap gap-2">
                {['Realtime speech', 'Instant search', 'Live subtitles'].map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/8 text-[12px] text-ink-200">
                    <Check size={11} className="text-white/60" /> {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ── FAQ ── */}
      <section id="faq" className="py-24 px-6 border-t border-white/8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-[12px] uppercase tracking-wider text-ink-300 mb-3">FAQ</div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Questions, answered</h2>
          </div>
          <div className="space-y-2">
            {faqs.map((f, i) => (
              <div key={i} className="rounded-xl bg-ink-850 border border-white/8 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition"
                >
                  <span className="text-[14px] font-medium text-white pr-4">{f.q}</span>
                  <ChevronDown size={16} className={cn('text-ink-200 transition-transform shrink-0', openFaq === i && 'rotate-180')} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-[13px] text-ink-200 leading-relaxed animate-slide-down">{f.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ── CTA ── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto rounded-3xl bg-ink-800 border border-white/10 p-12 md:p-16 text-center shadow-lift relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-20 -right-20 h-60 w-60 bg-white/[0.03] blur-[80px] rounded-full" />
            <div className="absolute -bottom-20 -left-20 h-60 w-60 bg-white/[0.02] blur-[80px] rounded-full" />
          </div>
          <div className="relative">
            <VoiceVisual />
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">Start talking to AI today</h2>
            <p className="mt-4 text-ink-200 max-w-lg mx-auto">Join thousands of professionals using Ksemo as their primary voice-first AI workspace. Free to start, no credit card required.</p>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
              {profile ? (
                <Link to="/app"><Button size="lg">Go to Workspace <ArrowRight size={16} /></Button></Link>
              ) : (
                <>
                  <Link to="/signup"><Button size="lg">Create your workspace <ArrowRight size={16} /></Button></Link>
                  <Link to="/login"><Button variant="outline" size="lg">Sign in</Button></Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>


      {/* ── Footer ── */}
      <footer className="border-t border-white/8 py-10 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <Link to="/" className="flex items-center gap-2 mb-3">
                <img src="/KSEMOlogo.png" alt="KSEMO" className="h-7 w-7 rounded-lg object-contain" />
                <span className="text-[15px] font-semibold text-white tracking-tight">Ksemo</span>
              </Link>
              <p className="text-[13px] text-ink-300 max-w-sm leading-relaxed">A voice-first AI workspace for people who think for a living. Talk, create, and organize — all in one focused environment.</p>
            </div>
            <div>
              <div className="text-[12px] font-semibold text-white uppercase tracking-wider mb-3">Product</div>
              <div className="space-y-2">
                <a href="#features" className="block text-[13px] text-ink-300 hover:text-white transition">Features</a>
                <a href="#faq" className="block text-[13px] text-ink-300 hover:text-white transition">FAQ</a>
              </div>
            </div>
            <div>
              <div className="text-[12px] font-semibold text-white uppercase tracking-wider mb-3">Account</div>
              <div className="space-y-2">
                {profile ? (
                  <Link to="/app" className="block text-[13px] text-ink-300 hover:text-white transition">Workspace</Link>
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
              <a href="#" className="text-[12px] text-ink-300 hover:text-white transition flex items-center gap-1">Privacy <ArrowUpRight size={10} /></a>
              <a href="#" className="text-[12px] text-ink-300 hover:text-white transition flex items-center gap-1">Terms <ArrowUpRight size={10} /></a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
