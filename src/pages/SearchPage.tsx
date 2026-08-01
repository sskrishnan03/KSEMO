import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Mic, Sparkles, ArrowRight, Clock, X } from 'lucide-react';
import { Input, EmptyState } from '../components/ui';
import { searchChats, searchMessages, addRecentSearch, getRecentSearches } from '../lib/data';
import type { Chat, Message } from '../lib/types';
import { cn, formatRelativeTime, truncate } from '../lib/utils';

type Tab = 'all' | 'chats' | 'messages';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<(Message & { chat?: { id: string; title: string } })[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setChats([]); setMessages([]); setSearched(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setSearched(true);
      try {
        const q = query.toLowerCase();
        const [c, m] = await Promise.all([
          searchChats(q),
          searchMessages(q),
        ]);
        setChats(c);
        setMessages(m);
        addRecentSearch(q);
        setRecentSearches(getRecentSearches());
      } catch { /* ignore */ }
      setLoading(false);
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const total = chats.length + messages.length;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: total },
    { id: 'chats', label: 'Chats', count: chats.length },
    { id: 'messages', label: 'Messages', count: messages.length },
  ];

  const showChats = tab === 'all' || tab === 'chats';
  const showMessages = tab === 'all' || tab === 'messages';

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Search</h1>
          <p className="mt-2 text-ink-300">Search chats, messages, images, documents, and files across your workspace.</p>
        </div>

        <div className="relative mb-6">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300" />
          <Input
            autoFocus
            placeholder="Search chats, messages, files…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={cn('pl-12 h-12 text-[15px]', query && 'pr-10')}
          />
          {loading && <span className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
          {!loading && query && (
            <button
              onClick={() => { setQuery(''); setChats([]); setMessages([]); setSearched(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-md text-ink-300 hover:text-white hover:bg-white/5 transition"
              title="Cancel search"
              aria-label="Cancel search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {searched && (
          <>
            <div className="flex gap-1 mb-6 border-b border-white/8 overflow-x-auto">
              {tabs.filter((t) => t.count > 0 || t.id === 'all').map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`whitespace-nowrap px-3 py-2 text-[13px] border-b-2 transition ${tab === t.id ? 'border-white text-white' : 'border-transparent text-ink-300 hover:text-white'}`}
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
                <Link key={c.id} to={`/app/voice-chat/${c.id}`} className="group flex items-center gap-3 rounded-xl bg-ink-850 border border-white/8 p-3.5 hover:border-white/15 transition">
                  <div className="h-9 w-9 rounded-lg bg-ink-800 border border-white/8 flex items-center justify-center text-ink-200"><Mic size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-white truncate">{c.title}</div>
                    <div className="text-[11px] text-ink-300">Voice Chat · {formatRelativeTime(c.updated_at)}</div>
                  </div>
                  <ArrowRight size={14} className="text-ink-300 group-hover:text-white transition" />
                </Link>
              ))}

              {showMessages && messages.map((m) => (
                <Link key={m.id} to={`/app/voice-chat/${m.chat_id}`} className="group block rounded-xl bg-ink-850 border border-white/8 p-3.5 hover:border-white/15 transition">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Sparkles size={13} className="text-ink-300" />
                    <span className="text-[11px] text-ink-300">{m.chat?.title ?? 'Chat'} · {formatRelativeTime(m.created_at)}</span>
                  </div>
                  <div className="text-[12px] text-ink-100 line-clamp-2">{truncate(m.content, 160)}</div>
                </Link>
              ))}


            </div>
          </>
        )}

        {!searched && (
          <div>
            {recentSearches.length > 0 && (
              <>
                <h2 className="text-[12px] uppercase tracking-wider text-ink-300 mb-3">Recent searches</h2>
                <div className="space-y-1">
                  {recentSearches.map((q) => (
                    <button key={q} onClick={() => setQuery(q)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-ink-200 hover:bg-white/5 hover:text-white transition">
                      <Clock size={14} className="text-ink-300" /> {q}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
