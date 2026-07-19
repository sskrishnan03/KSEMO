import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Plus, MessageSquare, Wand2, Search, Settings, Star, File,
  Archive, Trash2, Pin, Bell, Shield,
  MoreHorizontal, PanelLeftClose,
} from 'lucide-react';
import { cn, groupByDate, truncate } from '../lib/utils';
import { listChats, createChat, updateChat, deleteChat } from '../lib/data';
import { useAuthContext } from './AuthProvider';
import { Button, Modal } from './ui';
import type { Chat } from '../lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: Props) {
  const { profile } = useAuthContext();
  const loc = useLocation();
  const nav = useNavigate();
  const [chats, setChats] = useState<Chat[]>([]);
  const [menuChat, setMenuChat] = useState<Chat | null>(null);
  const [filter, setFilter] = useState<'all' | 'pinned' | 'archived'>('all');

  const load = async () => {
    try {
      const c = await listChats();
      setChats(c);
    } catch { /* ignore */ }
  };

  useEffect(() => { load(); }, []);

  const filtered = chats.filter((c) => {
    if (filter === 'pinned') return c.pinned;
    if (filter === 'archived') return c.archived;
    return !c.archived;
  });
  const grouped = groupByDate(filtered, 'updated_at');

  const newChat = async () => {
    const c = await createChat();
    if (c) {
      nav(`/app/chat/${c.id}`);
      onClose();
    }
  };

  const togglePin = async (c: Chat) => {
    await updateChat(c.id, { pinned: !c.pinned });
    setMenuChat(null);
    load();
  };
  const archiveChat = async (c: Chat) => {
    await updateChat(c.id, { archived: !c.archived });
    setMenuChat(null);
    load();
  };
  const removeChat = async (c: Chat) => {
    await deleteChat(c.id);
    setMenuChat(null);
    load();
    if (loc.pathname === `/app/chat/${c.id}`) nav('/app');
  };

  const navItems = [
    { to: '/app', icon: MessageSquare, label: 'Chats', active: loc.pathname === '/app' || loc.pathname.startsWith('/app/chat') },
    { to: '/app/tools', icon: Wand2, label: 'AI Tools', active: loc.pathname.startsWith('/app/tools') },
    { to: '/app/search', icon: Search, label: 'Search', active: loc.pathname.startsWith('/app/search') },
    { to: '/app/favorites', icon: Star, label: 'Favorites', active: loc.pathname.startsWith('/app/favorites') },
    { to: '/app/files', icon: File, label: 'Files', active: loc.pathname.startsWith('/app/files') },
    { to: '/app/history', icon: Archive, label: 'History', active: loc.pathname.startsWith('/app/history') },
  ];

  const isAdmin = profile?.role === 'admin';

  return (
    <>
      {/* Mobile backdrop */}
      {open && <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={onClose} />}

      <aside className={cn(
        'fixed md:sticky top-0 z-40 h-screen w-[280px] shrink-0 bg-ink-950 border-r border-white/8 flex flex-col transition-transform duration-300',
        open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      )}>
        {/* Header */}
        <div className="h-14 px-3 flex items-center justify-between border-b border-white/8">
          <Link to="/app" className="flex items-center gap-2 px-2">
            <div className="h-7 w-7 rounded-lg bg-ink-800 border border-white/10 flex items-center justify-center font-bold text-white text-[13px]">K</div>
            <span className="text-[15px] font-semibold tracking-tight">Ksemo</span>
          </Link>
          <button onClick={onClose} className="md:hidden h-8 w-8 rounded-lg flex items-center justify-center text-ink-300 hover:bg-white/5">
            <PanelLeftClose size={16} />
          </button>
        </div>

        {/* New chat */}
        <div className="p-3">
          <Button onClick={newChat} className="w-full justify-start">
            <Plus size={16} /> New chat
          </Button>
        </div>

        {/* Nav */}
        <nav className="px-2 pb-2 space-y-0.5">
          {navItems.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 h-9 rounded-lg text-[13px] transition-colors',
                n.active ? 'bg-white/8 text-white' : 'text-ink-200 hover:bg-white/5 hover:text-white',
              )}
            >
              <n.icon size={16} />
              {n.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              to="/app/admin"
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 h-9 rounded-lg text-[13px] transition-colors',
                loc.pathname.startsWith('/app/admin') ? 'bg-white/8 text-white' : 'text-ink-200 hover:bg-white/5 hover:text-white',
              )}
            >
              <Shield size={16} /> Admin
            </Link>
          )}
        </nav>

        {/* Chats filter */}
        <div className="px-3 pt-2 border-t border-white/8 flex items-center gap-1">
          {(['all', 'pinned', 'archived'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-2.5 h-7 rounded-lg text-[12px] capitalize transition',
                filter === f ? 'bg-white/10 text-white' : 'text-ink-300 hover:text-white hover:bg-white/5',
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Chats list */}
        <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-hide">
          {filtered.length === 0 && <p className="px-3 py-4 text-[12px] text-ink-300 text-center">No chats here yet</p>}
          {grouped.map((g) => (
            <div key={g.label} className="mb-2">
              <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-ink-300">{g.label}</div>
              {g.items.map((c) => {
                const active = loc.pathname === `/app/chat/${c.id}`;
                return (
                  <div key={c.id} className="group relative">
                    <Link
                      to={`/app/chat/${c.id}`}
                      onClick={onClose}
                      className={cn(
                        'flex items-center gap-2 px-3 h-9 rounded-lg text-[13px] transition-colors pr-8',
                        active ? 'bg-white/8 text-white' : 'text-ink-200 hover:bg-white/5 hover:text-white',
                      )}
                    >
                      {c.pinned && <Pin size={11} className="text-white shrink-0" />}
                      <span className="truncate">{truncate(c.title, 28)}</span>
                    </Link>
                    <button
                      onClick={() => setMenuChat(c)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded flex items-center justify-center text-ink-300 hover:text-white hover:bg-white/5 opacity-0 group-hover:opacity-100 transition"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-white/8 p-2">
          <Link to="/app/settings" onClick={onClose} className={cn(
            'flex items-center gap-3 px-3 h-10 rounded-lg text-[13px] transition-colors',
            loc.pathname.startsWith('/app/settings') ? 'bg-white/8 text-white' : 'text-ink-200 hover:bg-white/5 hover:text-white',
          )}>
            <Settings size={16} /> Settings
          </Link>
          <Link to="/app/notifications" onClick={onClose} className={cn(
            'flex items-center gap-3 px-3 h-10 rounded-lg text-[13px] transition-colors',
            loc.pathname.startsWith('/app/notifications') ? 'bg-white/8 text-white' : 'text-ink-200 hover:bg-white/5 hover:text-white',
          )}>
            <Bell size={16} /> Notifications
          </Link>
        </div>
      </aside>

      {/* Chat context menu */}
      <Modal open={!!menuChat} onClose={() => setMenuChat(null)} title="Chat actions" size="sm">
        {menuChat && (
          <div className="space-y-1">
            <button onClick={() => togglePin(menuChat)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-ink-100 hover:bg-white/5 hover:text-white transition">
              <Pin size={15} /> {menuChat.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button onClick={() => archiveChat(menuChat)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-ink-100 hover:bg-white/5 hover:text-white transition">
              <Archive size={15} /> {menuChat.archived ? 'Unarchive' : 'Archive'}
            </button>
            <button onClick={() => removeChat(menuChat)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-ink-100 hover:bg-white/5 hover:text-white transition">
              <Trash2 size={15} /> Delete
            </button>
          </div>
        )}
      </Modal>

    </>
  );
}
