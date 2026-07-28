import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Shield } from 'lucide-react';

export function AuthLayout({ children, title, subtitle, footer }: { children: ReactNode; title: string; subtitle: string; footer?: ReactNode }) {
  return (
    <div className="h-screen flex overflow-hidden select-none">
      {/* Left visual panel */}
      <div className="hidden lg:flex w-1/2 bg-ink-950 border-r border-white/8 relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0 grain opacity-60" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-[350px] w-[350px] bg-white/5 blur-[120px] rounded-full" />
        
        <Link to="/" className="relative flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-ink-800 border border-white/10 flex items-center justify-center font-bold text-white text-[14px]">K</div>
          <span className="text-[18px] font-semibold tracking-tight text-white">Ksemo</span>
        </Link>

        <div className="relative my-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-[12px] text-ink-100 mb-5">
            <Sparkles size={13} /> AI workspace
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.15] text-white">
            Your personal<br />AI workspace.
          </h2>
          <p className="mt-4 text-[15px] text-ink-200 max-w-sm leading-relaxed">
            A quiet place for your thoughts and conversations. Work with AI in a clean, focused charcoal interface.
          </p>

          <ul className="mt-8 space-y-4 text-[14px] text-ink-200">
            <li className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white shrink-0">
                <Sparkles size={15} />
              </div>
              <span>AI-powered chat and writing assistant</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white shrink-0">
                <Shield size={15} />
              </div>
              <span>Local-first, private by design</span>
            </li>
          </ul>
        </div>

        <div className="relative text-[13px] text-ink-300">
          <span>© 2026 Ksemo. All rights reserved.</span>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="lg:hidden p-6">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-ink-200 hover:text-white transition">
            <ArrowLeft size={15} /> Back to home
          </Link>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm">
            <h1 className="text-3xl font-bold tracking-tight text-white text-center">{title}</h1>
            <p className="mt-2 text-sm text-ink-200 text-center">{subtitle}</p>
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-6 text-center text-sm text-ink-200">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
