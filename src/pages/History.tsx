import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, ArrowRight, MessageSquare, Pin } from 'lucide-react';
import { EmptyState } from '../components/ui';
import { listChats } from '../lib/data';
import { groupByDate, formatRelativeTime } from '../lib/utils';
import type { Chat } from '../lib/types';

export default function History() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listChats().then((c) => setChats(c)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const pinned = chats.filter((c) => c.pinned && !c.archived);
  const active = chats.filter((c) => !c.archived);
  const archived = chats.filter((c) => c.archived);
  const activeGrouped = groupByDate(active, 'updated_at');
  const archivedGrouped = groupByDate(archived, 'updated_at');

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white">History</h1>
          <p className="mt-2 text-ink-300">All your conversations, organized by date.</p>
        </div>

        {loading && <div className="h-5 w-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />}

        {!loading && chats.length === 0 && (
          <EmptyState icon={<MessageSquare size={20} />} title="No conversations yet" description="Start a new chat to see your history here." />
        )}

        {pinned.length > 0 && (
          <div className="mb-8">
            <h2 className="text-[12px] uppercase tracking-wider text-ink-300 mb-3 flex items-center gap-1.5"><Pin size={12} /> Pinned</h2>
            <div className="space-y-1">
              {pinned.map((c) => <ChatRow key={c.id} c={c} />)}
            </div>
          </div>
        )}

        {activeGrouped.map((g) => (
          <div key={g.label} className="mb-8">
            <h2 className="text-[12px] uppercase tracking-wider text-ink-300 mb-3">{g.label}</h2>
            <div className="space-y-1">
              {g.items.map((c) => <ChatRow key={c.id} c={c} />)}
            </div>
          </div>
        ))}

        {archived.length > 0 && (
          <div className="mb-8">
            <h2 className="text-[12px] uppercase tracking-wider text-ink-300 mb-3 flex items-center gap-1.5"><Archive size={12} /> Archived</h2>
            <div className="space-y-1">
              {archivedGrouped.flatMap((g) => g.items).map((c) => <ChatRow key={c.id} c={c} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatRow({ c }: { c: Chat }) {
  return (
    <Link to={`/app/chat/${c.id}`} className="group flex items-center gap-3 rounded-xl p-3 hover:bg-white/5 transition">
      <div className="h-8 w-8 rounded-lg bg-ink-850 border border-white/8 flex items-center justify-center text-ink-200 group-hover:text-white transition">
        <MessageSquare size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-white truncate">{c.title}</div>
        <div className="text-[11px] text-ink-300">{formatRelativeTime(c.updated_at)}</div>
      </div>
      {c.archived && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-ink-300">Archived</span>}
      <ArrowRight size={14} className="text-ink-300 group-hover:text-white transition" />
    </Link>
  );
}
