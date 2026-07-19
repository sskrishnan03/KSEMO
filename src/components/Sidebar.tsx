import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Plus, MessageSquare, Wand2, Search, Settings, Star, File,
  Archive, Trash2, Pin, Shield,
  MoreHorizontal, PanelLeftClose, PanelLeftOpen, History, LogOut, Mic,
} from 'lucide-react';
import { cn, groupByDate, truncate, initials } from '../lib/utils';
import { listChats, createChat, updateChat, deleteChat } from '../lib/data';
import { useAuthContext } from './AuthProvider';
import { Button, Modal } from './ui';
import type { Chat } from '../lib/types';

interface Props {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ collapsed, onToggleCollapse }: Props) {
  const { profile, signOut } = useAuthContext();
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
    if (loc.pathname.startsWith('/app/chat/')) {
      const currentId = loc.pathname.split('/app/chat/')[1];
      const current = chats.find((c) => c.id === currentId);
      if (current && current.title === 'New chat') return;
    }
    const c = await createChat();
    if (c) nav(`/app/chat/${c.id}`);
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
    { to: '/app/history', icon: History, label: 'History', active: loc.pathname.startsWith('/app/history') },
  ];

  const isAdmin = profile?.role === 'admin';
  const isCollapsed = collapsed;

  return (
    <>
      {/* Collapsed icon rail */}
      {isCollapsed && (
        <aside className="sticky top-0 z-40 h-screen w-[60px] shrink-0 bg-ink-950 border-r border-white/8 flex flex-col items-center py-3 gap-1 transition-all duration-300">
          {/* Expand toggle */}
          <button
            onClick={onToggleCollapse}
            className="h-9 w-9 rounded-xl flex items-center justify-center text-ink-300 hover:text-white hover:bg-white/8 transition-all duration-200 mb-1"
            title="Expand sidebar"
          >
            <PanelLeftOpen size={17} />
          </button>

          {/* New chat icon */}
          <button
            onClick={newChat}
            className="h-9 w-9 rounded-xl flex items-center justify-center text-ink-300 hover:text-white hover:bg-white/8 transition-all duration-200"
            title="New chat"
          >
            <Plus size={18} />
          </button>

          {/* Voice chat icon */}
          <Link
            to="/app/voice-chat"
            className={cn(
              'h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200',
              loc.pathname === '/app/voice-chat' ? 'text-white bg-white/10' : 'text-ink-300 hover:text-white hover:bg-white/8',
            )}
            title="Voice Chat"
          >
            <Mic size={17} />
          </Link>

          <div className="w-7 h-px bg-white/8 my-1" />

          {/* Nav icons */}
          {navItems.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                'h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200',
                n.active ? 'text-white bg-white/10' : 'text-ink-300 hover:text-white hover:bg-white/8',
              )}
              title={n.label}
            >
              <n.icon size={17} />
            </Link>
          ))}
          {isAdmin && (
            <Link
              to="/app/admin"
              className={cn(
                'h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200',
                loc.pathname.startsWith('/app/admin') ? 'text-white bg-white/10' : 'text-ink-300 hover:text-white hover:bg-white/8',
              )}
              title="Admin"
            >
              <Shield size={17} />
            </Link>
          )}

          <div className="flex-1" />

          {/* Footer icons */}
          <div className="w-7 h-px bg-white/8 my-1" />
          <Link
            to="/app/settings"
            className={cn(
              'h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200',
              loc.pathname.startsWith('/app/settings') ? 'text-white bg-white/10' : 'text-ink-300 hover:text-white hover:bg-white/8',
            )}
            title="Settings"
          >
            <Settings size={17} />
          </Link>
          <button
            onClick={() => { signOut(); nav('/login', { replace: true }); }}
            className="h-9 w-9 rounded-xl flex items-center justify-center text-ink-300 hover:text-white hover:bg-white/8 transition-all duration-200"
            title="Sign out"
          >
            <div className="h-7 w-7 rounded-full bg-ink-700 border border-white/10 flex items-center justify-center text-[10px] font-semibold text-white">
              {initials((profile?.full_name || profile?.username) ?? '')}
            </div>
          </button>
        </aside>
      )}

      {/* Full sidebar */}
      <aside className={cn(
        'sticky top-0 z-40 h-screen w-[280px] shrink-0 bg-ink-950 border-r border-white/8 flex flex-col transition-all duration-300',
        isCollapsed && 'hidden',
      )}>
        {/* Header */}
        <div className="h-14 px-3 flex items-center justify-between border-b border-white/8">
          <Link to="/app" className="flex items-center gap-2 px-2">
            <div className="h-7 w-7 rounded-lg bg-ink-800 border border-white/10 flex items-center justify-center font-bold text-white text-[13px]">K</div>
            <span className="text-[15px] font-semibold tracking-tight">Ksemo</span>
          </Link>
          <button onClick={onToggleCollapse} className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-300 hover:bg-white/5 hover:text-white transition" title="Collapse sidebar">
            <PanelLeftClose size={16} />
          </button>
        </div>

        {/* New chat */}
        <div className="p-3 space-y-1.5">
          <Button onClick={newChat} className="w-full justify-start">
            <Plus size={16} /> New chat
          </Button>
          <button
            onClick={() => nav('/app/voice-chat')}
            className={cn(
              'w-full flex items-center gap-2 px-3 h-9 rounded-lg text-[13px] font-medium transition-all duration-200',
              loc.pathname === '/app/voice-chat'
                ? 'bg-white/8 text-white'
                : 'text-ink-200 hover:bg-white/5 hover:text-white',
            )}
          >
            <span className="relative flex items-center justify-center">
              <Mic size={15} />
              <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-white/40 animate-pulse-soft" />
            </span>
            Voice Chat
          </button>
        </div>

        {/* Nav */}
        <nav className="px-2 pb-2 space-y-0.5">
          {navItems.map((n) => (
            <Link
              key={n.to}
              to={n.to}
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
                      className={cn(
                        'flex items-center gap-2 px-3 h-9 rounded-lg text-[13px] transition-colors pr-8',
                        active ? 'bg-white/8 text-white' : 'text-ink-200 hover:bg-white/5 hover:text-white',
                      )}
                    >
                      {c.pinned && <Pin size={11} className="text-white shrink-0" />}
                      {c.type === 'voice' && <Mic size={12} className="text-ink-300 shrink-0" />}
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
        <div className="border-t border-white/8 p-2 space-y-0.5">
          <Link to="/app/settings" className={cn(
            'flex items-center gap-3 px-3 h-10 rounded-lg text-[13px] transition-colors',
            loc.pathname.startsWith('/app/settings') ? 'bg-white/8 text-white' : 'text-ink-200 hover:bg-white/5 hover:text-white',
          )}>
            <Settings size={16} /> Settings
          </Link>
          <div className="flex items-center gap-3 px-3 h-10 rounded-lg text-[13px] text-ink-200">
            <div className="h-6 w-6 rounded-full bg-ink-700 border border-white/10 flex items-center justify-center text-[10px] font-semibold text-white shrink-0">
              {initials(profile?.full_name || profile?.username || '')}
            </div>
            <span className="truncate flex-1">{profile?.full_name || profile?.username}</span>
            <button
              onClick={() => { signOut(); nav('/login', { replace: true }); }}
              className="h-7 w-7 rounded-md flex items-center justify-center text-ink-400 hover:text-white hover:bg-white/5 transition shrink-0"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
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
