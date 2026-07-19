import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, MessageSquare, Wand2, Search, Star, TrendingUp, ArrowRight,
  Sparkles, Zap, FileText, GitCompare,
} from 'lucide-react';
import { listChats, createChat } from '../lib/data';
import { useAuthContext } from '../components/AuthProvider';
import type { Chat } from '../lib/types';
import { cn, formatRelativeTime, groupByDate } from '../lib/utils';

const suggestions = [
  { title: 'Write a product launch email', icon: FileText },
  { title: 'Explain async/await in JavaScript', icon: Zap },
  { title: 'Summarize a research paper for me', icon: FileText },
  { title: 'Debug a React useEffect loop', icon: Sparkles },
  { title: 'Draft a 7-day content plan', icon: TrendingUp },
  { title: 'Compare REST vs GraphQL', icon: GitCompare },
];

export default function Dashboard() {
  const { profile } = useAuthContext();
  const nav = useNavigate();
  const [chats, setChats] = useState<Chat[]>([]);

  useEffect(() => {
    listChats().then(setChats).catch(() => {});
  }, []);

  const newChat = async () => {
    const c = await createChat();
    if (c) nav(`/app/chat/${c.id}`);
  };

  const recent = groupByDate(chats.filter((c) => !c.archived), 'updated_at').slice(0, 2);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Greeting */}
        <div className="mb-10">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">
            {greeting()}, {profile?.full_name?.split(' ')[0] || profile?.username || 'there'}.
          </h1>
          <p className="mt-2 text-ink-300">What would you like to work on today?</p>
        </div>

        {/* Quick actions */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
          {[
            { icon: Plus, label: 'New chat', to: '/app', action: newChat, primary: true },
            { icon: Wand2, label: 'AI tools', to: '/app/tools' },
            { icon: Search, label: 'Search', to: '/app/search' },
            { icon: Star, label: 'Favorites', to: '/app/favorites' },
          ].map((a) => (
            a.action ? (
              <button key={a.label} onClick={a.action} className={cn(
                'group rounded-2xl border p-4 flex items-center gap-3 transition-all hover:shadow-lift',
                a.primary ? 'bg-white text-ink-900 border-white hover:bg-ink-100' : 'bg-ink-850 border-white/8 hover:border-white/15 text-white',
              )}>
                <a.icon size={18} />
                <span className="text-[14px] font-medium">{a.label}</span>
                <ArrowRight size={15} className="ml-auto opacity-50 group-hover:translate-x-0.5 transition-transform" />
              </button>
            ) : (
              <Link key={a.label} to={a.to} className="group rounded-2xl bg-ink-850 border border-white/8 p-4 flex items-center gap-3 transition-all hover:border-white/15 hover:shadow-lift text-white">
                <a.icon size={18} />
                <span className="text-[14px] font-medium">{a.label}</span>
                <ArrowRight size={15} className="ml-auto opacity-50 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            )
          ))}
        </div>

        {/* Suggestions */}
        <div className="mb-12">
          <h2 className="text-[13px] uppercase tracking-wider text-ink-300 mb-3">Try asking</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {suggestions.map((s) => (
              <button
                key={s.title}
                onClick={async () => { const c = await createChat({ title: s.title }); if (c) nav(`/app/chat/${c.id}`); }}
                className="group flex items-center gap-3 rounded-xl bg-ink-850 border border-white/8 p-3.5 text-left hover:border-white/15 transition"
              >
                <div className="h-8 w-8 rounded-lg bg-ink-800 border border-white/8 flex items-center justify-center text-ink-200 group-hover:text-white transition">
                  <s.icon size={15} />
                </div>
                <span className="text-[13px] text-ink-100 group-hover:text-white transition flex-1">{s.title}</span>
                <ArrowRight size={14} className="text-ink-300 group-hover:text-white transition" />
              </button>
            ))}
          </div>
        </div>

        {/* Recent chats */}
        {recent.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[13px] uppercase tracking-wider text-ink-300">Recent chats</h2>
              <Link to="/app/history" className="text-[12px] text-ink-200 hover:text-white transition">View all</Link>
            </div>
            <div className="space-y-1">
              {recent.flatMap((g) => g.items).slice(0, 6).map((c) => (
                <Link key={c.id} to={`/app/chat/${c.id}`} className="group flex items-center gap-3 rounded-xl p-3 hover:bg-white/5 transition">
                  <div className="h-8 w-8 rounded-lg bg-ink-850 border border-white/8 flex items-center justify-center text-ink-200 group-hover:text-white transition">
                    <MessageSquare size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-white truncate">{c.title}</div>
                    <div className="text-[11px] text-ink-300">{formatRelativeTime(c.updated_at)}</div>
                  </div>
                  <ArrowRight size={14} className="text-ink-300 group-hover:text-white transition" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
