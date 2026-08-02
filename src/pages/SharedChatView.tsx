import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Globe, ArrowUpRight, Copy, Check } from 'lucide-react';
import { Markdown } from '../components/Markdown';
import { Button } from '../components/ui';
import { fetchSharedChat } from '../lib/data';

interface DecodedShare {
  title: string;
  messages: { role: string; content: string }[];
}

function Avatar() {
  return (
    <img src="/KSEMOlogo.png" alt="KSEMO" className="h-8 w-8 rounded-full object-contain shrink-0 select-none" />
  );
}

export default function SharedChatView() {
  const { shareData } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState<DecodedShare | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [invalid, setInvalid] = useState(false);

  // Legacy fallback: older share links embedded the chat as base64 in the URL.
  const decodeLegacy = (raw: string): DecodedShare | null => {
    try {
      let base64 = raw.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const json = new TextDecoder().decode(bytes);
      const decoded = JSON.parse(json);
      if (decoded && decoded.title && Array.isArray(decoded.messages)) {
        return { title: decoded.title, messages: decoded.messages };
      }
    } catch {
      /* ignore */
    }
    return null;
  };

  useEffect(() => {
    if (!shareData) {
      setInvalid(true);
      return;
    }
    let cancelled = false;
    setInvalid(false);
    setData(null);

    const load = async () => {
      const shared = await fetchSharedChat(shareData);
      if (cancelled) return;
      if (shared && shared.title && Array.isArray(shared.messages)) {
        setData(shared);
        return;
      }
      const legacy = decodeLegacy(shareData);
      if (!cancelled && legacy) {
        setData(legacy);
        return;
      }
      if (!cancelled) setInvalid(true);
    };
    load();

    return () => { cancelled = true; };
  }, [shareData]);

  const handleCopyText = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(idx);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  if (invalid) {
    return (
      <div className="min-h-screen bg-ink-900 text-white flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
          <Globe size={24} className="text-ink-300" />
        </div>
        <h1 className="text-xl font-bold tracking-tight mb-2">Invalid or Expired Link</h1>
        <p className="text-[13px] text-ink-300 max-w-sm leading-relaxed mb-6">
          This shared link appears to be malformed or has been removed. Check the link and try again.
        </p>
        <Button size="sm" onClick={() => nav('/')}>
          Go to Ksemo
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-ink-900 text-white flex flex-col items-center justify-center p-6">
        <span className="h-2 w-2 rounded-full bg-white/60 animate-pulse-soft" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-900 text-white flex flex-col">
      {/* Public Share Top Header Bar */}
      <header className="h-14 px-4 md:px-6 border-b border-white/8 flex items-center justify-between glass shrink-0 select-none">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
            <span className="font-bold text-white text-[15px]">K</span>
          </div>
          <div className="min-w-0 flex flex-col">
            <h1 className="text-[13px] font-semibold text-white truncate max-w-[200px] md:max-w-md">
              {data.title}
            </h1>
            <div className="flex items-center gap-1 text-[10px] text-ink-300">
              <Globe size={10} />
              <span>Public shared conversation</span>
            </div>
          </div>
        </div>

        <Button size="sm" className="flex items-center gap-1.5 shrink-0" onClick={() => nav('/signup')}>
          Create an account <ArrowUpRight size={12} />
        </Button>
      </header>

      {/* Main Conversation container */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
          {data.messages.map((m, idx) => {
            const isUser = m.role === 'user';
            return (
              <div key={idx} className={`group flex gap-3 animate-fade-in ${isUser ? 'flex-row-reverse' : ''}`}>
                {!isUser && <Avatar />}
                <div className={`flex-1 min-w-0 ${isUser ? 'max-w-[85%] flex flex-col items-end' : 'max-w-[90%]'}`}>
                  {!isUser && (
                    <div className="mb-1 select-none">
                      <span className="text-[12px] font-medium text-white">Ksemo</span>
                    </div>
                  )}
                  {isUser ? (
                    <div className="rounded-2xl px-4 py-3 bg-white/10 border border-white/8 break-words overflow-hidden">
                      <Markdown content={m.content} />
                    </div>
                  ) : (
                    <div className="break-words overflow-hidden">
                      <Markdown content={m.content} />
                    </div>
                  )}

                  {/* Quick actions for public read only bubble */}
                  <div className={`mt-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${isUser ? 'flex-row-reverse' : ''}`}>
                    <button
                      onClick={() => handleCopyText(m.content, idx)}
                      className={`h-6 w-6 rounded flex items-center justify-center transition text-ink-300 hover:text-white hover:bg-white/5 ${copiedId === idx ? 'text-emerald-400' : ''}`}
                      title={copiedId === idx ? 'Copied' : 'Copy'}
                    >
                      {copiedId === idx ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer Branding banner */}
      <footer className="py-4 border-t border-white/5 bg-ink-950 text-center select-none">
        <p className="text-[10px] text-ink-400">
          This conversation was generated with Ksemo AI. Learn more at <span className="underline cursor-pointer text-white" onClick={() => nav('/')}>ksemo.com</span>.
        </p>
      </footer>
    </div>
  );
}
