import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Sparkles, MessageSquare, Layers, Shield, ChevronDown,
  Menu, X, Bot, Wand2,
} from 'lucide-react';
import { Button } from '../components/ui';
import { cn } from '../lib/utils';
import { useAuthContext } from '../components/AuthProvider';



const features = [
  { icon: MessageSquare, title: 'Realtime streaming chat', desc: 'Token-by-token responses with markdown, code blocks, tables, and math. Stop, regenerate, and continue on demand.' },
  { icon: Wand2, title: '20+ AI tools', desc: 'Summarizer, translator, code generator, SQL builder, regex maker, email writer, flashcards, and more.' },
  { icon: Layers, title: 'Organized workspace', desc: 'Pinned chats, favorites, categories, and full-text search across every conversation you have.' },
  { icon: Shield, title: 'Private by design', desc: 'Row-level security on every table, encrypted sessions, audit logs, and your data never leaves your workspace.' },
];

const faqs = [
  { q: 'What is Ksemo?', a: 'Ksemo is an AI workspace — a focused, monochrome environment for chatting with AI, organizing conversations, and running purpose-built AI tools.' },
  { q: 'Is my data private?', a: 'Every table uses row-level security so you can only ever access your own data. Sessions are encrypted, and you can export or delete your data at any time from Settings.' },
  { q: 'Does it work offline?', a: 'Ksemo runs in the browser. The local engine produces responses even when no backend is connected, so the app is always usable.' },
  { q: 'Can I cancel anytime?', a: 'Yes. Plans are month-to-month and you can cancel or downgrade from Settings at any time. Your data stays yours.' },
];



function TypingDemo() {
  const fullText = 'Ksemo is an AI workspace where every tool and every conversation lives in one calm, focused place.';
  const [typed, setTyped] = useState('');
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i <= fullText.length) {
        setTyped(fullText.slice(0, i));
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => setShowCursor(false), 1200);
      }
    }, 32);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-2xl glass border border-white/10 p-6 shadow-glow">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-7 w-7 rounded-lg bg-ink-800 border border-white/10 flex items-center justify-center">
          <Sparkles size={14} className="text-white" />
        </div>
        <span className="text-sm font-medium text-white">Ksemo</span>
        <span className="ml-auto text-[11px] text-ink-300 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse-soft" /> streaming
        </span>
      </div>
      <p className="text-[15px] leading-relaxed text-ink-100 min-h-[3rem]">
        {typed}
        {showCursor && <span className="inline-block w-[2px] h-4 bg-white ml-0.5 animate-blink-caret align-middle" />}
      </p>
      <div className="mt-4 flex gap-2">
        <div className="flex-1 h-9 rounded-xl bg-ink-850 border border-white/10 px-3 flex items-center text-[13px] text-ink-300">
          Ask anything…
        </div>
        <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center">
          <ArrowRight size={16} className="text-ink-900" />
        </div>
      </div>
    </div>
  );
}



export default function Landing() {
  const { profile } = useAuthContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-ink-900 text-white grain">
      {/* Nav */}
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

      {/* Hero */}
      <section ref={heroRef} className="relative pt-36 pb-20 px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[400px] w-[600px] bg-white/5 blur-[120px] rounded-full" />
        </div>
        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-[12px] text-ink-100 mb-6 animate-fade-in">
            <Sparkles size={13} /> An AI workspace
          </div>
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05] text-balance animate-slide-up">
            Your personal AI workspace.
          </h1>
          <p className="mt-6 text-lg text-ink-200 max-w-2xl mx-auto text-balance animate-slide-up" style={{ animationDelay: '60ms' }}>
            Ksemo unifies AI-powered tools and your entire conversation history into a
            calm, focused charcoal workspace designed for thinking.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 animate-slide-up" style={{ animationDelay: '120ms' }}>
            {profile ? (
              <Link to="/app"><Button size="lg">Go to Workspace <ArrowRight size={16} /></Button></Link>
            ) : (
              <Link to="/signup"><Button size="lg">Start free <ArrowRight size={16} /></Button></Link>
            )}
            <a href="#features"><Button variant="outline" size="lg">See features</Button></a>
          </div>
          <p className="mt-4 text-[12px] text-ink-300 animate-fade-in">No credit card required · 50 messages a day on Free</p>
        </div>

        <div className="relative max-w-3xl mx-auto mt-16 animate-slide-up" style={{ animationDelay: '200ms' }}>
          <TypingDemo />
        </div>
      </section>



      {/* Features */}
      <section id="features" className="py-24 px-6">
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



      {/* Tools strip */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="text-[12px] uppercase tracking-wider text-ink-300 mb-3">AI Tools</div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">20+ purpose-built tools</h2>
          <p className="mt-4 text-ink-200 max-w-xl mx-auto">Summarizer, translator, code generator, SQL builder, regex maker, email writer, flashcards, quiz maker, and more.</p>
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {['Summarizer', 'Translator', 'Grammar Fix', 'Code Generator', 'Bug Fixer', 'SQL Generator', 'Regex Generator', 'Email Writer', 'Blog Writer', 'Resume Writer', 'Math Solver', 'Research Assistant', 'Meeting Notes', 'Flashcards', 'Quiz Generator', 'Mind Maps', 'Flowcharts'].map((t) => (
              <span key={t} className="px-3.5 py-2 rounded-xl bg-ink-850 border border-white/8 text-[13px] text-ink-100 hover:border-white/15 hover:text-white transition cursor-default">
                {t}
              </span>
            ))}
          </div>
          <div className="mt-10">
            <Link to="/signup"><Button size="lg">Try every tool <ArrowRight size={16} /></Button></Link>
          </div>
        </div>
      </section>





      {/* FAQ */}
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
                  <span className="text-[14px] font-medium text-white">{f.q}</span>
                  <ChevronDown size={16} className={cn('text-ink-200 transition-transform', openFaq === i && 'rotate-180')} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-[13px] text-ink-200 leading-relaxed animate-slide-down">{f.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto rounded-3xl bg-ink-800 border border-white/10 p-12 text-center shadow-lift">
          <Bot size={32} className="mx-auto text-white mb-4" />
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">Start thinking with AI today</h2>
          <p className="mt-4 text-ink-200 max-w-lg mx-auto">Join thousands of professionals using Ksemo as their primary AI workspace.</p>
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
      </section>

      {/* Footer */}
      <footer className="border-t border-white/8 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-ink-800 border border-white/10 flex items-center justify-center font-bold text-white text-[13px]">K</div>
              <span className="text-[15px] font-semibold text-white tracking-tight">Ksemo</span>
            </Link>
            <span className="text-white/20 text-xs hidden sm:inline">|</span>
            <p className="text-[12px] text-ink-300">An AI workspace for people who think for a living.</p>
          </div>
          <p className="text-[12px] text-ink-300">© 2026 Ksemo. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
