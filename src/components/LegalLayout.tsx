import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Home } from 'lucide-react';

interface LegalLayoutProps {
  title: string;
  updated: string;
  children: ReactNode;
}

export function LegalLayout({ title, updated, children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-ink-900 text-white grain">
      <header className="fixed top-0 inset-x-0 z-50 glass-strong border-b border-white/8">
        <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/KSEMOlogo.png" alt="KSEMO" className="h-8 w-8 rounded-xl object-contain" />
            <span className="text-[17px] font-semibold tracking-tight">Ksemo</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-ink-200">
            <a href="#privacy" className="hover:text-white transition">Privacy</a>
            <a href="#terms" className="hover:text-white transition">Terms</a>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login" className="text-sm text-ink-200 hover:text-white transition">Sign in</Link>
            <Link to="/signup" className="flex items-center gap-1.5 text-sm font-medium bg-ink-50 text-ink-900 border border-ink-200 hover:bg-ink-100 rounded-lg h-8 px-3 transition">
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <main className="pt-28 pb-20 px-6">
        <div className="max-w-3xl mx-auto">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-ink-300 hover:text-white transition mb-6">
            <Home size={14} />
            Back to home
          </Link>

          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-balance mb-2">{title}</h1>
          <p className="text-sm text-ink-300 mb-10">Last updated: {updated}</p>

          <div className="space-y-10">{children}</div>
        </div>
      </main>

      <footer className="border-t border-white/8 py-10 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <Link to="/" className="flex items-center gap-2 mb-3">
                <img src="/KSEMOlogo.png" alt="KSEMO" className="h-7 w-7 rounded-lg object-contain" />
                <span className="text-[15px] font-semibold text-white tracking-tight">Ksemo</span>
              </Link>
              <p className="text-[13px] text-ink-300 max-w-sm leading-relaxed">An AI voice chat for people who think for a living. Talk, create, and organize — all in one focused environment.</p>
            </div>
            <div>
              <div className="text-[12px] font-semibold text-white uppercase tracking-wider mb-3">Product</div>
              <div className="space-y-2">
                <Link to="/" className="block text-[13px] text-ink-300 hover:text-white transition">Home</Link>
                <Link to="/signup" className="block text-[13px] text-ink-300 hover:text-white transition">Get started</Link>
              </div>
            </div>
            <div>
              <div className="text-[12px] font-semibold text-white uppercase tracking-wider mb-3">Legal</div>
              <div className="space-y-2">
                <Link to="/privacy" className="block text-[13px] text-ink-300 hover:text-white transition">Privacy Policy</Link>
                <Link to="/terms" className="block text-[13px] text-ink-300 hover:text-white transition">Terms of Service</Link>
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

interface LegalSectionProps {
  heading?: string;
  children: ReactNode;
}

export function LegalSection({ heading, children }: LegalSectionProps) {
  return (
    <section>
      {heading && <h2 className="text-xl font-semibold text-white mb-3">{heading}</h2>}
      <div className="text-sm text-ink-200 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}
