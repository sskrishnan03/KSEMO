import { useEffect, useState, useLayoutEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  SquarePen, MessageSquare, Wand2, Search, Settings, File,
  Archive, Trash2, Pin, Shield,
  MoreHorizontal, PanelLeft, History, LogOut, Mic,
  Edit2, Share2, HelpCircle,
} from 'lucide-react';
import { cn, groupByDate, truncate, initials } from '../lib/utils';
import { listChats, createChat, updateChat, deleteChat } from '../lib/data';
import { useAuthContext } from './AuthProvider';
import { Button, Modal } from './ui';
import type { Chat } from '../lib/types';
import { ShareModal } from './ShareModal';

interface Props {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ collapsed, onToggleCollapse }: Props) {
  const { profile, signOut } = useAuthContext();
  const loc = useLocation();
  const nav = useNavigate();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeMenuChatId, setActiveMenuChatId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pinned' | 'archived'>('all');

  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [shareChat, setShareChat] = useState<Chat | null>(null);

  const [activeRect, setActiveRect] = useState<DOMRect | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const closeMenu = () => {
    setActiveMenuChatId(null);
    setActiveRect(null);
  };

  const openMenu = (e: React.MouseEvent, chatId: string, currentTitle: string) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveRect(rect);
    setRenameTitle(currentTitle);
    setActiveMenuChatId(chatId);
    setConfirmDeleteId(null);
  };


  useLayoutEffect(() => {
    if (!activeMenuChatId || !dropdownRef.current || !activeRect) return;

    const dropdownHeight = dropdownRef.current.offsetHeight;
    const rect = activeRect;

    if (rect.bottom + 4 + dropdownHeight > window.innerHeight) {
      dropdownRef.current.style.top = 'auto';
      dropdownRef.current.style.bottom = `${window.innerHeight - rect.top + 4}px`;
    } else {
      dropdownRef.current.style.bottom = 'auto';
      dropdownRef.current.style.top = `${rect.bottom + 4}px`;
    }
    dropdownRef.current.style.left = `${rect.left}px`;
    dropdownRef.current.style.visibility = 'visible';
  }, [activeMenuChatId, activeRect, confirmDeleteId]);

  const handleRenameSubmit = async (e: React.FormEvent, c: Chat) => {
    e.preventDefault();
    if (!renameTitle.trim()) return;
    await updateChat(c.id, { title: renameTitle.trim() });
    load();
    setRenamingChatId(null);
  };

  const handleShare = (c: Chat) => {
    setShareChat(c);
  };

  const menuChat = chats.find((c) => c.id === activeMenuChatId);

  const load = async () => {
    try {
      const c = await listChats();
      setChats(c);
    } catch { /* ignore */ }
  };

  useEffect(() => { load(); }, [loc.pathname]);

  const filtered = chats.filter((c) => {
    if (filter === 'pinned') return c.pinned && !c.archived;
    if (filter === 'archived') return c.archived;
    return !c.archived && !c.pinned;
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
    closeMenu();
    load();
  };
  const archiveChat = async (c: Chat) => {
    await updateChat(c.id, { archived: !c.archived });
    closeMenu();
    load();
  };

  const navItems = [
    { to: '/app/search', icon: Search, label: 'Search', active: loc.pathname.startsWith('/app/search'), animationClass: 'icon-wiggle' },
    { to: '/app/tools', icon: Wand2, label: 'AI Tools', active: loc.pathname.startsWith('/app/tools'), animationClass: 'icon-wiggle' },
    { to: '/app/files', icon: File, label: 'Files', active: loc.pathname.startsWith('/app/files'), animationClass: 'icon-bounce' },
    { to: '/app/history', icon: History, label: 'History', active: loc.pathname.startsWith('/app/history'), animationClass: 'icon-bounce' },
  ];

  const isAdmin = profile?.role === 'admin';
  const isCollapsed = collapsed;

  return (
    <>
      <aside className={cn(
        'sticky top-0 z-40 h-screen shrink-0 bg-ink-950 border-r border-white/8 transition-all duration-300 ease-in-out overflow-hidden relative',
        isCollapsed ? 'w-[60px]' : 'w-[280px]'
      )}>
        {/* Collapsed icon rail */}
        <div className={cn(
          'absolute inset-y-0 left-0 w-[60px] flex flex-col items-center py-3 gap-1 transition-opacity duration-300 ease-in-out',
          isCollapsed ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}>
          {/* Expand toggle */}
          <button
            onClick={onToggleCollapse}
            className="group h-9 w-9 rounded-xl flex items-center justify-center text-ink-300 hover:text-white hover:bg-white/8 transition-all duration-200 mb-1"
            title="Expand sidebar"
          >
            <PanelLeft size={17} className="transition-transform duration-500 rotate-180" />
          </button>

          {/* New chat icon */}
          <button
            onClick={newChat}
            className="group h-9 w-9 rounded-xl flex items-center justify-center text-ink-300 hover:text-white hover:bg-white/8 transition-all duration-200"
            title="New chat"
          >
            <SquarePen size={18} className="icon-bounce" />
          </button>

          {/* Voice chat icon */}
          <Link
            to="/app/voice-chat"
            className={cn(
              'group h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200',
              loc.pathname === '/app/voice-chat' ? 'text-white bg-white/10' : 'text-ink-300 hover:text-white hover:bg-white/8',
            )}
            title="Voice Chat"
          >
            <Mic size={17} className="icon-wiggle" />
          </Link>

          {/* Nav icons */}
          {navItems.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                'group h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200',
                n.active ? 'text-white bg-white/10' : 'text-ink-300 hover:text-white hover:bg-white/8',
              )}
              title={n.label}
            >
              <n.icon size={17} className={n.animationClass} />
            </Link>
          ))}
          {isAdmin && (
            <Link
              to="/app/admin"
              className={cn(
                'group h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200',
                loc.pathname.startsWith('/app/admin') ? 'text-white bg-white/10' : 'text-ink-300 hover:text-white hover:bg-white/8',
              )}
              title="Admin"
            >
              <Shield size={17} className="icon-wiggle" />
            </Link>
          )}

          <div className="flex-1" />

          {/* Footer icons */}
          <button
            onClick={() => setAccountMenuOpen(!accountMenuOpen)}
            className={cn(
              'h-9 w-9 rounded-xl flex items-center justify-center text-ink-300 hover:text-white hover:bg-white/8 transition-all duration-200',
              accountMenuOpen && 'bg-white/10 text-white'
            )}
            title="Account Menu"
          >
            <div className="h-7 w-7 rounded-full bg-ink-700 border border-white/10 flex items-center justify-center text-[10px] font-semibold text-white">
              {initials((profile?.full_name || profile?.username) ?? '')}
            </div>
          </button>
        </div>

        {/* Full sidebar */}
        <div className={cn(
          'absolute inset-y-0 left-0 w-[280px] flex flex-col transition-opacity duration-300 ease-in-out',
          isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
        )}>
          {/* Header */}
          <div className="h-14 px-3 flex items-center justify-between border-b border-white/8 shrink-0">
            <Link to="/" className="flex items-center gap-2 px-2 select-none">
              <div className="h-7 w-7 rounded-lg bg-ink-800 border border-white/10 flex items-center justify-center font-bold text-white text-[13px]">K</div>
              <span className="text-[15px] font-semibold tracking-tight text-white/90">Ksemo</span>
            </Link>
            <button onClick={onToggleCollapse} className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-300 hover:bg-white/5 hover:text-white transition shrink-0" title="Collapse sidebar">
              <PanelLeft size={16} className="transition-transform duration-500 rotate-0" />
            </button>
          </div>

          {/* Nav */}
          <nav className="px-2 pt-3 pb-2 space-y-0.5 shrink-0">
            {/* Action buttons */}
            <button
              onClick={newChat}
              className="group w-full flex items-center gap-3 px-3 h-9 rounded-lg text-[13px] text-ink-200 hover:bg-white/5 hover:text-white transition-colors"
            >
              <SquarePen size={16} className="icon-bounce" />
              New Chat
            </button>
            <button
              onClick={() => nav('/app/voice-chat')}
              className={cn(
                'group w-full flex items-center gap-3 px-3 h-9 rounded-lg text-[13px] text-left transition-colors',
                loc.pathname === '/app/voice-chat' ? 'bg-white/8 text-white' : 'text-ink-200 hover:bg-white/5 hover:text-white',
              )}
            >
              <Mic size={16} className="shrink-0 icon-wiggle" />
              Voice Chat
            </button>

            {/* Other nav items */}
            {navItems.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  'group flex items-center gap-3 px-3 h-9 rounded-lg text-[13px] transition-colors',
                  n.active ? 'bg-white/8 text-white' : 'text-ink-200 hover:bg-white/5 hover:text-white',
                )}
              >
                <n.icon size={16} className={n.animationClass} />
                {n.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/app/admin"
                className={cn(
                  'group flex items-center gap-3 px-3 h-9 rounded-lg text-[13px] transition-colors',
                  loc.pathname.startsWith('/app/admin') ? 'bg-white/8 text-white' : 'text-ink-200 hover:bg-white/5 hover:text-white',
                )}
              >
                <Shield size={16} className="icon-wiggle" /> Admin
              </Link>
            )}
          </nav>

          {/* Chats filter */}
          <div className="px-3 pt-2 border-t border-white/8 flex items-center gap-1 shrink-0">
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
                  const isMenuOpen = activeMenuChatId === c.id;
                  return (
                    <div key={c.id} className="group relative">
                      {renamingChatId === c.id ? (
                        <form
                          onSubmit={(e) => handleRenameSubmit(e, c)}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-white/5 border border-white/10 my-0.5"
                        >
                          <input
                            type="text"
                            value={renameTitle}
                            onChange={(e) => setRenameTitle(e.target.value)}
                            className="flex-1 min-w-0 bg-transparent text-white text-[13px] focus:outline-none font-medium"
                            autoFocus
                            required
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setRenamingChatId(null);
                            }}
                          />
                          <button type="submit" className="text-[10px] text-white bg-ink-800 hover:bg-ink-700 border border-white/10 font-medium px-2 py-0.5 rounded transition">
                            Save
                          </button>
                        </form>
                      ) : (
                        <>
                          <Link
                            to={`/app/chat/${c.id}`}
                            className={cn(
                              'flex items-center gap-2 px-3 h-9 rounded-lg text-[13px] transition-colors pr-8',
                              active ? 'bg-white/8 text-white' : 'text-ink-200 hover:bg-white/5 hover:text-white',
                            )}
                          >
                            {c.type === 'voice' ? (
                              <Mic size={14} className="text-ink-300 shrink-0" />
                            ) : (
                              <MessageSquare size={14} className="text-ink-300 shrink-0" />
                            )}
                            <span className="truncate">{truncate(c.title, 28)}</span>
                          </Link>
                          <button
                            onClick={(e) => openMenu(e, c.id, c.title)}
                            className={cn(
                              "absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded flex items-center justify-center text-ink-300 hover:text-white hover:bg-white/5 transition",
                              isMenuOpen ? "opacity-100 bg-white/5 text-white" : "opacity-0 group-hover:opacity-100"
                            )}
                          >
                            <MoreHorizontal size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-white/8 p-2 shrink-0">
            <button
              onClick={() => setAccountMenuOpen(!accountMenuOpen)}
              className={cn(
                'w-full flex items-center gap-3 px-3 h-11 rounded-lg text-[13px] text-ink-200 hover:bg-white/5 hover:text-white transition-all duration-200 text-left',
                accountMenuOpen && 'bg-white/5 text-white'
              )}
            >
              <div className="h-7 w-7 rounded-full bg-ink-700 border border-white/10 flex items-center justify-center text-[10px] font-semibold text-white shrink-0">
                {initials(profile?.full_name || profile?.username || '')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-white truncate">{profile?.full_name || profile?.username}</div>
                <div className="text-[10px] text-ink-400 truncate">Free Account</div>
              </div>
            </button>
          </div>
        </div>
      </aside>

      {/* Floating fixed Dropdown Menu (rendered outside sidebar to prevent overflow clipping) */}
      {activeMenuChatId && menuChat && (
        <>
          <div className="fixed inset-0 z-40 cursor-default" onClick={closeMenu} />
          <div 
            ref={dropdownRef}
            className="fixed z-50 w-44 rounded-xl bg-ink-900 border border-white/10 p-1 shadow-2xl animate-in fade-in duration-100"
            style={{ visibility: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-0.5">
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(menuChat); closeMenu(); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-ink-100 hover:bg-white/5 hover:text-white transition text-left"
              >
                <Pin size={13} className="text-ink-300" /> {menuChat.pinned ? 'Unpin' : 'Pin'}
              </button>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); archiveChat(menuChat); closeMenu(); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-ink-100 hover:bg-white/5 hover:text-white transition text-left"
              >
                <Archive size={13} className="text-ink-300" /> {menuChat.archived ? 'Unarchive' : 'Archive'}
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setRenameTitle(menuChat.title);
                  setRenamingChatId(menuChat.id);
                  closeMenu();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-ink-100 hover:bg-white/5 hover:text-white transition text-left"
              >
                <Edit2 size={13} className="text-ink-300" /> Rename
              </button>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleShare(menuChat); closeMenu(); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-ink-100 hover:bg-white/5 hover:text-white transition text-left"
              >
                <Share2 size={13} className="text-ink-300" /> Share Chat
              </button>
              <div className="h-px bg-white/5 my-1" />
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(menuChat.id); closeMenu(); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-red-400 hover:bg-red-500/10 hover:text-red-300 transition text-left"
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </div>
        </>
      )}

      {accountMenuOpen && (
        <>
          <div className="fixed inset-0 z-40 cursor-default" onClick={() => setAccountMenuOpen(false)} />
          <div className={cn(
            'fixed z-50 rounded-xl bg-ink-900 border border-white/10 p-1 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200',
            isCollapsed ? 'bottom-16 left-3 w-[180px]' : 'bottom-16 left-3 w-[254px]'
          )}>
            <div className="px-2.5 py-2 border-b border-white/5 mb-1">
              <div className="text-[11px] text-ink-400 font-medium">Logged in as</div>
              <div className="text-[13px] text-white font-medium truncate">{profile?.full_name || profile?.username}</div>
            </div>
            
            <button
              onClick={() => { setAccountMenuOpen(false); nav('/app/settings'); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] text-ink-100 hover:bg-white/5 hover:text-white transition text-left"
            >
              <Settings size={14} className="text-ink-300" />
              Settings
            </button>
            
            <button
              onClick={() => { setAccountMenuOpen(false); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] text-ink-100 hover:bg-white/5 hover:text-white transition text-left"
            >
              <HelpCircle size={14} className="text-ink-300" />
              Help & Support
            </button>

            <div className="h-px bg-white/5 my-1" />

            <button
              onClick={() => { signOut(); nav('/login', { replace: true }); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] text-red-400 hover:bg-red-500/10 hover:text-red-300 transition text-left"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </>
      )}
      {confirmDeleteId && (() => {
        const chatToDelete = chats.find(c => c.id === confirmDeleteId);
        const chatTitle = chatToDelete ? chatToDelete.title : 'this conversation';
        return (
          <Modal
            open={!!confirmDeleteId}
            onClose={() => setConfirmDeleteId(null)}
            title="Delete Conversation"
            size="sm"
            footer={
              <>
                <Button variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)}>
                  Cancel
                </Button>
                <Button 
                  variant="danger" 
                  size="sm" 
                  onClick={async () => {
                    if (confirmDeleteId) {
                      await deleteChat(confirmDeleteId);
                      load();
                      if (loc.pathname === `/app/chat/${confirmDeleteId}`) {
                        nav('/app');
                      }
                    }
                    setConfirmDeleteId(null);
                  }}
                >
                  Delete
                </Button>
              </>
            }
          >
            <div className="text-[13px] text-ink-200 leading-relaxed">
              Are you sure you want to permanently delete the conversation <strong className="text-white">"{chatTitle}"</strong>? This will delete all messages and any files attached to it. This action cannot be undone.
            </div>
          </Modal>
        );
      })()}

      {shareChat && (
        <ShareModal
          open={!!shareChat}
          onClose={() => setShareChat(null)}
          chat={shareChat}
        />
      )}
    </>
  );
}
