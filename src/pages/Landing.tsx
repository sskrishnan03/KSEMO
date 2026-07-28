import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Sparkles, MessageSquare, Layers, Shield, ChevronDown,
  Menu, X, Bot, Search, Pin, Zap, Brain,
  Lock, Check, ArrowUpRight,
} from 'lucide-react';
import { Button } from '../components/ui';
import { cn } from '../lib/utils';
import { useAuthContext } from '../components/AuthProvider';

/* ──────────────────── data ──────────────────── */

const features = [
  { icon: MessageSquare, title: 'Realtime streaming chat', desc: 'Token-by-token responses with markdown, code blocks, tables, and math. Stop, regenerate, and continue on demand.' },
  { icon: Layers, title: 'Organized workspace', desc: 'Pinned chats, favorites, categories, and full-text search across every conversation you have.' },
  { icon: Shield, title: 'Private by design', desc: 'Row-level security on every table, encrypted sessions, and your data never leaves your workspace.' },
  { icon: Search, title: 'Search everything', desc: 'Full-text search across all chats, messages, and files. Find anything instantly with instant results.' },
  { icon: Brain, title: 'Multi-model support', desc: 'Switch between AI models mid-conversation. Use the best model for each task — coding, writing, analysis.' },
];

const faqs = [
  { q: 'What is Ksemo?', a: 'Ksemo is an AI workspace — a focused, monochrome environment for chatting with AI and organizing conversations. Think of it as your personal AI command center.' },
  { q: 'Is my data private?', a: 'Every table uses row-level security so you can only ever access your own data. Sessions are encrypted, and you can export or delete your data at any time from Settings.' },
  { q: 'Does it work offline?', a: 'Ksemo runs in the browser. The local engine produces responses even when no backend is connected, so the app is always usable.' },
  { q: 'Which AI models are supported?', a: 'Ksemo connects to leading AI providers including OpenAI, Anthropic, Google, and open-source models via OpenRouter. You can switch models per conversation.' },
  { q: 'Can I cancel anytime?', a: 'Yes. Plans are month-to-month and you can cancel or downgrade from Settings at any time. Your data stays yours.' },
  { q: 'How is this different from ChatGPT?', a: 'Ksemo is a workspace, not just a chat. It organizes conversations, supports multiple models, and keeps everything in a focused, distraction-free environment.' },
];

/* ──────────────────── Demo conversations ──────────────────── */

const demoConversations = [
  {
    label: 'Casual chat',
    userMsg: 'Hi, how are you?',
    assistantText: "Hey! I'm doing great — ready to help with whatever you need. How about you? What's on your mind today?",
  },
  {
    label: 'Creative writing',
    userMsg: 'Write me a short poem about the ocean at night',
    assistantText: "**Moonlit Tides**\n\nThe ocean breathes in silver light,\nWhere stars dissolve into the deep.\nEach wave a whisper, soft and slight,\nA lullaby the waters keep.\n\nThe moon pulls strings of liquid glass,\nAnd shadows dance on foaming crests.\nBelow, the ancient creatures pass —\nThe sea gives up no secrets yet.\n\nAnd on the shore, where sand meets spray,\nThe world grows quiet, vast, and free.\nEach tide rewrites the edge of day,\nAnd nothing is as it will be.\n\n---\n\nWant me to try a different style or theme?",
  },
  {
    label: 'Quick question',
    userMsg: 'What\'s the difference between a virus and a bacteria?',
    assistantText: "Great question — here's the simple breakdown:\n\n**Bacteria** are single-celled living organisms. They can survive on their own, and most are actually helpful — your gut has trillions of them. Only a small fraction cause disease.\n\n**Viruses** are not truly alive. They're tiny packets of genetic material wrapped in protein. They can't reproduce on their own — they need to hijack a living cell to make copies.\n\nKey differences:\n- Bacteria are **much larger** than viruses (10-100x)\n- Antibiotics kill bacteria, but **don't work** on viruses\n- Viral infections usually resolve on their own; bacterial ones sometimes need antibiotics\n- Vaccines are especially effective against viruses\n\nWant me to go deeper on any of these points?",
  },
];

/* ──────────────────── Animated chat demo (matches real app UI) ──────────────────── */

function ChatDemo() {
  const [conversationIdx, setConversationIdx] = useState(0);
  const [typedText, setTypedText] = useState('');
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'typing-user' | 'streaming' | 'done'>('idle');
  const [userTyped, setUserTyped] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const conv = demoConversations[conversationIdx];

  const renderMarkdown = useCallback((text: string) => {
    return text.split('\n\n').map((paragraph, pi) => {
      if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
        return <p key={pi} className="text-[14px] font-semibold text-white mt-4 mb-2 leading-relaxed">{paragraph.slice(2, -2)}</p>;
      }
      if (paragraph === '---') {
        return <hr key={pi} className="border-white/10 my-4" />;
      }
      const parts = paragraph.split(/(\*\*.*?\*\*|\n)/g);
      return (
        <p key={pi} className="text-[14px] text-ink-200 leading-[1.7] mb-3">
          {parts.map((part, i) => {
            if (part === '\n') return <br key={i} />;
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={i} className="text-white font-medium">{part.slice(2, -2)}</strong>;
            }
            return part;
          })}
        </p>
      );
    });
  }, []);

  const startConversation = useCallback(() => {
    setTypedText('');
    setUserTyped('');
    setPhase('typing-user');

    let ui = 0;
    const um = conv.userMsg;
    const userTypeTimer = setInterval(() => {
      if (ui <= um.length) {
        setUserTyped(um.slice(0, ui));
        ui++;
      } else {
        clearInterval(userTypeTimer);
        setTimeout(() => {
          setPhase('streaming');
          let ci = 0;
          const fullText = conv.assistantText;
          const streamTimer = setInterval(() => {
            if (ci <= fullText.length) {
              setTypedText(fullText.slice(0, ci));
              ci += 2;
            } else {
              clearInterval(streamTimer);
              setPhase('done');
              timerRef.current = setTimeout(() => {
                setConversationIdx((prev) => (prev + 1) % demoConversations.length);
              }, 5000);
            }
          }, 14);
        }, 600);
      }
    }, 30);
  }, [conv]);

  useEffect(() => {
    if (started) {
      if (timerRef.current) clearTimeout(timerRef.current);
      startConversation();
    }
  }, [conversationIdx, started, startConversation]);

  const startDemo = useCallback(() => {
    if (started) return;
    setStarted(true);
    startConversation();
  }, [started, startConversation]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) startDemo(); },
      { threshold: 0.15 },
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [startDemo]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div ref={ref} className="relative max-w-5xl mx-auto">
      <div className="absolute -inset-10 bg-white/[0.02] blur-[80px] rounded-full pointer-events-none" />

      <div className="relative rounded-2xl border border-white/10 bg-ink-900 overflow-hidden shadow-glow">
        <div className="flex min-h-[540px]">

          {/* ── Sidebar (matches real app) ── */}
          <div className="hidden md:flex flex-col w-[260px] bg-ink-950 border-r border-white/8">
            {/* Sidebar header */}
            <div className="h-14 px-3 flex items-center gap-2.5 border-b border-white/8 shrink-0">
              <div className="h-7 w-7 rounded-lg bg-ink-800 border border-white/10 flex items-center justify-center font-bold text-white text-[13px]">K</div>
              <span className="text-[15px] font-semibold tracking-tight text-white/90">Ksemo</span>
            </div>

            {/* Nav items */}
            <div className="px-2 pt-3 pb-2 space-y-0.5">
              <div className="flex items-center gap-3 h-9 px-3 rounded-lg text-[13px] text-ink-200 hover:bg-white/5 cursor-default">
                <MessageSquare size={16} className="text-ink-300" /> New Chat
              </div>
              <div className="flex items-center gap-3 h-9 px-3 rounded-lg text-[13px] text-ink-200 hover:bg-white/5 cursor-default">
                <Search size={16} className="text-ink-300" /> Search
              </div>
            </div>

            {/* Filters */}
            <div className="px-3 pt-2 pb-1 border-t border-white/8">
              <div className="flex gap-1">
                <span className="px-2.5 h-7 rounded-lg text-[12px] bg-white/10 text-white flex items-center">All</span>
                <span className="px-2.5 h-7 rounded-lg text-[12px] text-ink-300 hover:text-white hover:bg-white/5 flex items-center cursor-default">Pinned</span>
              </div>
            </div>

            {/* Chat list */}
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
              <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-ink-300">Today</div>
              {demoConversations.map((c, i) => (
                <div key={c.label} className={cn(
                  'flex items-center gap-2 px-3 h-9 rounded-lg text-[13px]',
                  i === conversationIdx ? 'bg-white/8 text-white' : 'text-ink-200 hover:bg-white/5',
                )}>
                  <MessageSquare size={14} className="text-ink-300 shrink-0" />
                  <span className="truncate">{c.label}</span>
                  {i === 0 && <Pin size={10} className="ml-auto shrink-0 text-ink-400" />}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-white/8 p-2">
              <div className="flex items-center gap-2.5 h-11 px-2 rounded-lg hover:bg-white/5 cursor-default">
                <div className="h-7 w-7 rounded-full bg-ink-700 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white shrink-0">U</div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-white truncate">User</div>
                  <div className="text-[10px] text-ink-400">Free Account</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Chat area ── */}
          <div className="flex-1 flex flex-col bg-ink-900">

            {/* Chat header */}
            <div className="h-14 px-4 border-b border-white/8 flex items-center gap-3 glass shrink-0">
              <MessageSquare size={16} className="text-ink-300" />
              <span className="text-[14px] font-medium text-white truncate">{conv.label}</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

                {/* User message (right-aligned, bubble) */}
                {phase !== 'idle' && (
                  <div className="flex gap-3 flex-row-reverse animate-fade-in">
                    <div className="h-8 w-8 rounded-xl bg-ink-800 border border-white/10 flex items-center justify-center shrink-0 text-[13px] font-bold text-white">U</div>
                    <div className="max-w-[50%] flex flex-col items-end">
                      <div className="rounded-2xl px-4 py-3 bg-white/10 border border-white/8 break-words">
                        <p className="text-[14px] text-white leading-relaxed">
                          {userTyped}
                          {phase === 'typing-user' && userTyped.length < conv.userMsg.length && (
                            <span className="inline-block w-[2px] h-4 bg-white ml-0.5 animate-blink-caret align-middle" />
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Assistant message (left-aligned, no bubble) */}
                {phase === 'streaming' && typedText && (
                  <div className="flex gap-3 animate-fade-in">
                    <div className="h-8 w-8 rounded-xl bg-ink-800 border border-white/10 flex items-center justify-center shrink-0">
                      <span className="text-[13px] font-bold text-white">K</span>
                    </div>
                    <div className="flex-1 min-w-0 max-w-[90%]">
                      <p className="text-[12px] font-medium text-white mb-1">Ksemo</p>
                      <div className="text-[14px] text-ink-200 leading-[1.7] break-words overflow-hidden">
                        {renderMarkdown(typedText)}
                        <span className="inline-block w-[2px] h-4 bg-white ml-0.5 animate-blink-caret align-middle" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Assistant message fully rendered */}
                {phase === 'done' && (
                  <div className="flex gap-3 animate-fade-in">
                    <div className="h-8 w-8 rounded-xl bg-ink-800 border border-white/10 flex items-center justify-center shrink-0">
                      <span className="text-[13px] font-bold text-white">K</span>
                    </div>
                    <div className="flex-1 min-w-0 max-w-[90%]">
                      <p className="text-[12px] font-medium text-white mb-1">Ksemo</p>
                      <div className="text-[14px] text-ink-200 leading-[1.7] break-words overflow-hidden">
                        {renderMarkdown(conv.assistantText)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Streaming loading dots */}
                {phase === 'streaming' && !typedText && (
                  <div className="flex gap-3 animate-fade-in">
                    <div className="h-8 w-8 rounded-xl bg-ink-800 border border-white/10 flex items-center justify-center shrink-0">
                      <span className="text-[13px] font-bold text-white">K</span>
                    </div>
                    <div>
                      <p className="text-[12px] font-medium text-white mb-1">Ksemo</p>
                      <div className="flex items-center gap-1.5 h-8">
                        <div className="h-2 w-2 rounded-full bg-white/60 animate-pulse-soft" style={{ animationDelay: '0ms' }} />
                        <div className="h-2 w-2 rounded-full bg-white/60 animate-pulse-soft" style={{ animationDelay: '150ms' }} />
                        <div className="h-2 w-2 rounded-full bg-white/60 animate-pulse-soft" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Composer (matches real app) */}
            <div className="px-3 md:px-6 pb-4 md:pb-6 pt-2 shrink-0">
              <div className="max-w-3xl mx-auto">
                <div className="composer-shell">
                  <div className="composer-glow" />
                  <div className="relative z-10 flex items-end gap-1 px-2 py-2 md:px-3 md:py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] text-ink-400 px-1 py-2">Ask Ksemo anything...</p>
                    </div>
                    <button className="c-send h-9 w-9 rounded-xl flex items-center justify-center shrink-0">
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
                <p className="mt-2.5 text-center text-[10.5px] text-ink-400 tracking-wide">Ksemo can make mistakes. Check important info.</p>
              </div>
            </div>
          </div>
        </div>
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
            <div className="h-8 w-8 rounded-xl bg-ink-800 border border-white/10 flex items-center justify-center font-bold text-white">K</div>
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
            <Sparkles size={13} /> An AI workspace
          </div>
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05] text-balance animate-slide-up">
            Your personal AI workspace.
          </h1>
          <p className="mt-6 text-lg text-ink-200 max-w-2xl mx-auto text-balance animate-slide-up" style={{ animationDelay: '60ms' }}>
            Ksemo unifies AI chat and your entire conversation history into a
            calm, focused charcoal workspace designed for thinking.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 animate-slide-up" style={{ animationDelay: '120ms' }}>
            {profile ? (
              <Link to="/app"><Button size="lg">Go to Workspace <ArrowRight size={16} /></Button></Link>
            ) : (
              <Link to="/signup"><Button size="lg">Start free <ArrowRight size={16} /></Button></Link>
            )}
            <a href="#demo"><Button variant="outline" size="lg">See it in action</Button></a>
          </div>
          <p className="mt-4 text-[12px] text-ink-300 animate-fade-in">No credit card required · 50 messages a day on Free</p>
        </div>
      </section>


      {/* ── Live Chat Demo ── */}
      <section id="demo" className="py-16 px-6">
        <div className="max-w-5xl mx-auto text-center mb-10">
          <div className="text-[12px] uppercase tracking-wider text-ink-300 mb-3">Live preview</div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">See Ksemo in action</h2>
          <p className="mt-4 text-ink-200 max-w-xl mx-auto">Real conversations streaming live — ask anything and get intelligent, beautifully formatted answers.</p>
        </div>
        <ChatDemo />
      </section>


      {/* ── Features ── */}
      <section id="features" className="py-24 px-6 border-t border-white/8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="text-[12px] uppercase tracking-wider text-ink-300 mb-3">Features</div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">Everything you need to think with AI</h2>
            <p className="mt-4 text-ink-200">Built to feel like one cohesive product, not a bag of features bolted together.</p>
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
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">From idea to answer in seconds</h2>
            <p className="mt-4 text-ink-200">Three steps. No setup. No configuration. Just start typing.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', icon: MessageSquare, title: 'Start a conversation', desc: 'Open Ksemo and type your question. Pick a model, attach context, or just go — the AI adapts to you.' },
              { step: '02', icon: Zap, title: 'Get instant answers', desc: 'Streaming responses appear token by token. Code blocks, tables, math, and markdown render beautifully.' },
              { step: '03', icon: Layers, title: 'Organize & revisit', desc: 'Every conversation is saved, searchable, and sortable. Pin what matters, categorize the rest, find anything later.' },
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
              <p className="text-sm text-ink-300 leading-relaxed mb-6">Every conversation is encrypted. Row-level security means even database admins can't see your data. Export or delete everything from Settings at any time.</p>
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
              <p className="text-sm text-ink-300 leading-relaxed mb-6">Token-by-token streaming means you see responses as they're generated. No waiting for the full answer — start reading immediately.</p>
              <div className="flex flex-wrap gap-2">
                {['Sub-100ms streaming', 'Instant search', 'Optimistic UI'].map((tag) => (
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
            <Bot size={36} className="mx-auto text-white mb-5" />
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">Start thinking with AI today</h2>
            <p className="mt-4 text-ink-200 max-w-lg mx-auto">Join thousands of professionals using Ksemo as their primary AI workspace. Free to start, no credit card required.</p>
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
                <div className="h-7 w-7 rounded-lg bg-ink-800 border border-white/10 flex items-center justify-center font-bold text-white text-[13px]">K</div>
                <span className="text-[15px] font-semibold text-white tracking-tight">Ksemo</span>
              </Link>
              <p className="text-[13px] text-ink-300 max-w-sm leading-relaxed">An AI workspace for people who think for a living. Chat, create, and organize — all in one focused environment.</p>
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
