import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MessageSquare, FileText, Sparkles, ArrowRight, Clock } from 'lucide-react';
import { Input, EmptyState } from '../components/ui';
import { searchChats, searchMessages, listUploads } from '../lib/data';
import type { Chat, Message, Upload } from '../lib/types';
import { formatRelativeTime, truncate } from '../lib/utils';

type Tab = 'all' | 'chats' | 'messages' | 'files';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<(Message & { chat?: { id: string; title: string } })[]>([]);
  const [files, setFiles] = useState<Upload[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setChats([]); setMessages([]); setFiles([]); setSearched(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setSearched(true);
      try {
        const [c, m, f] = await Promise.all([
          searchChats(query),
          searchMessages(query),
          listUploads().then((all) => all.filter((u) => u.name.toLowerCase().includes(query.toLowerCase()))),
        ]);
        setChats(c); setMessages(m); setFiles(f);
      } catch { /* ignore */ }
      setLoading(false);
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const total = chats.length + messages.length + files.length;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: total },
    { id: 'chats', label: 'Chats', count: chats.length },
    { id: 'messages', label: 'Messages', count: messages.length },
    { id: 'files', label: 'Files', count: files.length },
  ];

  const showChats = tab === 'all' || tab === 'chats';
  const showMessages = tab === 'all' || tab === 'messages';
  const showFiles = tab === 'all' || tab === 'files';

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Search</h1>
          <p className="mt-2 text-ink-300">Search chats, messages, and files across your workspace.</p>
        </div>

        <div className="relative mb-6">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300" />
          <Input
            autoFocus
            placeholder="Search chats, messages, files…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-12 h-12 text-[15px]"
          />
          {loading && <span className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
        </div>

        {searched && (
          <>
            <div className="flex gap-1 mb-6 border-b border-white/8">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-2 text-[13px] border-b-2 transition ${tab === t.id ? 'border-white text-white' : 'border-transparent text-ink-300 hover:text-white'}`}
                >
                  {t.label} <span className="text-ink-300">{t.count}</span>
                </button>
              ))}
            </div>

            {total === 0 && !loading && (
              <EmptyState icon={<Search size={20} />} title={`No results for "${query}"`} description="Try a different search term." />
            )}

            <div className="space-y-2">
              {showChats && chats.map((c) => (
                <Link key={c.id} to={`/app/chat/${c.id}`} className="group flex items-center gap-3 rounded-xl bg-ink-850 border border-white/8 p-3.5 hover:border-white/15 transition">
                  <div className="h-9 w-9 rounded-lg bg-ink-800 border border-white/8 flex items-center justify-center text-ink-200"><MessageSquare size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-white truncate">{c.title}</div>
                    <div className="text-[11px] text-ink-300">Chat · {formatRelativeTime(c.updated_at)}</div>
                  </div>
                  <ArrowRight size={14} className="text-ink-300 group-hover:text-white transition" />
                </Link>
              ))}

              {showMessages && messages.map((m) => (
                <Link key={m.id} to={`/app/chat/${m.chat_id}`} className="group block rounded-xl bg-ink-850 border border-white/8 p-3.5 hover:border-white/15 transition">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Sparkles size={13} className="text-ink-300" />
                    <span className="text-[11px] text-ink-300">{m.chat?.title ?? 'Chat'} · {formatRelativeTime(m.created_at)}</span>
                  </div>
                  <div className="text-[12px] text-ink-100 line-clamp-2">{truncate(m.content, 160)}</div>
                </Link>
              ))}

              {showFiles && files.map((f) => (
                <div key={f.id} className="flex items-center gap-3 rounded-xl bg-ink-850 border border-white/8 p-3.5">
                  <div className="h-9 w-9 rounded-lg bg-ink-800 border border-white/8 flex items-center justify-center text-ink-200"><FileText size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-white truncate">{f.name}</div>
                    <div className="text-[11px] text-ink-300">File · {formatRelativeTime(f.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!searched && (
          <div>
            <h2 className="text-[12px] uppercase tracking-wider text-ink-300 mb-3">Recent searches</h2>
            <div className="space-y-1">
              {['summary', 'react', 'email', 'sql'].map((q) => (
                <button key={q} onClick={() => setQuery(q)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-ink-200 hover:bg-white/5 hover:text-white transition">
                  <Clock size={14} className="text-ink-300" /> {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
