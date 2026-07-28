import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Square, Copy, Check,
  Pencil, Share2,
  Volume2, RotateCw, Star, MoreHorizontal, Trash2, Mic, ArrowUp,
  Plus, FileText, Image, Globe, Search,
} from 'lucide-react';
import { Button, Modal, Textarea } from '../components/ui';
import { Markdown } from '../components/Markdown';
import { useAuthContext } from '../components/AuthProvider';
import type { Chat, Message, AppPreferences } from '../lib/types';
import { listMessages, insertMessage, updateMessage, deleteMessage, updateChat, logUsage, addFavorite, removeFavorite, isFavorite, getSettings } from '../lib/data';
import { supabase } from '../lib/supabase';
import { streamChat, type ChatMessage, type ContentPart } from '../lib/ai';
import { estimateTokens, cn } from '../lib/utils';
import { ShareModal } from '../components/ShareModal';
import { parseFile, buildFileMessage } from '../lib/fileParser';
import { setLastActiveChatId } from '../lib/data';

function getTimeOfDayGreeting(name: string): string {
  const hr = new Date().getHours();
  let timeGreeting = 'Hello';
  if (hr < 12) timeGreeting = 'Good morning';
  else if (hr < 17) timeGreeting = 'Good afternoon';
  else if (hr < 22) timeGreeting = 'Good evening';
  else timeGreeting = 'Good night';

  const displayName = name ? `, ${name}` : '';
  return `${timeGreeting}${displayName}. How can I help you today?`;
}

function getFirstName(profile: { full_name?: string | null; username?: string | null } | null): string {
  if (!profile?.full_name && !profile?.username) return '';
  const name = profile?.full_name || profile?.username || '';
  return name.split(/\s+/)[0];
}

export default function ChatWorkspace() {
  const { chatId } = useParams();
  const loc = useLocation();
  const nav = useNavigate();
  const { profile, user } = useAuthContext();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameText, setRenameText] = useState('');
  const [recording, setRecording] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [confirmDeleteMessageId, setConfirmDeleteMessageId] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<AppPreferences>({});
  const [featureMenuOpen, setFeatureMenuOpen] = useState(false);
  const [featureMenuUp, setFeatureMenuUp] = useState(false);
  const [deepResearch, setDeepResearch] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const featureMenuRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const isEmpty = messages.length === 0 && !streaming;
  const firstName = useMemo(() => getFirstName(profile), [profile]);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const playChime = (start: boolean) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      if (start) {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08);
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16);
      } else {
        osc.frequency.setValueAtTime(783.99, ctx.currentTime);
        osc.frequency.setValueAtTime(523.25, ctx.currentTime + 0.1);
      }
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } catch { /* silent */ }
  };

  const loadChat = useCallback(async () => {
    if (!chatId) return;
    setLoading(true);
    setLastActiveChatId(chatId);
    const msgs = await listMessages(chatId);
    setMessages(msgs);
    const { data } = await supabase.from('chats').select('*').eq('id', chatId).maybeSingle();
    if (data) {
      setChat(data as Chat);
      setRenameText(data.title);
    }
    setLoading(false);
  }, [chatId]);

  useEffect(() => { loadChat(); }, [loadChat]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, streamText]);

  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, [input]);

  useEffect(() => {
    if (loc.state?.prefillInput) {
      setInput(loc.state.prefillInput);
      if (loc.state?.prefillImage) {
        setPendingImage(loc.state.prefillImage);
      }
      nav(loc.pathname, { replace: true, state: {} });
    }
  }, [chatId, loc.state, nav]);

  useEffect(() => {
    if (user) getSettings(user.id).then((s) => setPrefs(s?.preferences ?? {})).catch(() => {});
  }, [user]);

  useEffect(() => {
    const handler = () => { if (streaming) stop(); };
    window.addEventListener('ksemo-stop-generation', handler);
    return () => window.removeEventListener('ksemo-stop-generation', handler);
  }, [streaming]);

  useEffect(() => {
    if (!featureMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (featureMenuRef.current && !featureMenuRef.current.contains(e.target as Node)) setFeatureMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [featureMenuOpen]);

  const addRipple = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    const size = Math.max(rect.width, rect.height);
    ripple.className = 'c-ripple';
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);
  };

  const handleFileAttach = (accept?: string) => {
    if (fileInputRef.current) {
      if (accept) fileInputRef.current.setAttribute('accept', accept);
      else fileInputRef.current.removeAttribute('accept');
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseFile(file);
      const msg = buildFileMessage(parsed);

      if (parsed.imageDataUrl) {
        setPendingImage(parsed.imageDataUrl);
        setInput((prev) => {
          const prefix = prev ? prev + '\n\n' : '';
          return prefix + msg.text;
        });
      } else {
        setInput((prev) => {
          const prefix = prev ? prev + '\n\n' : '';
          return prefix + msg.text;
        });
      }
    } catch {
      setInput((prev) => prev + (prev ? '\n' : '') + `[Attached: ${file.name}]`);
    }
    e.target.value = '';
  };

  const send = async () => {
    if (!input.trim() || !chatId || streaming) return;
    let content = input.trim();
    const imageToSend = pendingImage;
    setInput('');
    setPendingImage(null);

    if (deepResearch) {
      content = '[Deep Research mode enabled] Conduct thorough research and provide a comprehensive, in-depth analysis. ' + content;
      setDeepResearch(false);
    }
    if (webSearch) {
      content = '[Web Search mode enabled] Search the web for the latest information and provide up-to-date results. ' + content;
      setWebSearch(false);
    }

    const userContent: string | ContentPart[] = imageToSend
      ? [{ type: 'text', text: content }, { type: 'image_url', image_url: { url: imageToSend } }]
      : content;

    const userMsg = await insertMessage({ chat_id: chatId, role: 'user', content: typeof userContent === 'string' ? userContent : content + '\n\n[Image attached]' });
    if (userMsg) setMessages((m) => [...m, userMsg]);

    if (chat?.title === 'New chat' && (prefs.auto_rename_chats ?? true)) {
      const title = content.slice(0, 48) + (content.length > 48 ? '...' : '');
      await updateChat(chatId, { title });
      setChat((c) => c ? { ...c, title } : c);
      setRenameText(title);
    }

    setStreaming(true);
    setStreamText('');
    const controller = new AbortController();
    abortRef.current = controller;

    const historyMsgs = [...messages, { role: 'user' as const, content: typeof userContent === 'string' ? userContent : content + '\n\n[Image attached for analysis]' }];
    const history: ChatMessage[] = historyMsgs.map((m) => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content }));

    if (imageToSend && history.length > 0) {
      const lastMsg = history[history.length - 1];
      lastMsg.content = [
        { type: 'text', text: content },
        { type: 'image_url', image_url: { url: imageToSend } },
      ];
    }

    try {
      const result = await streamChat({
        model: 'ksemo-pro', messages: history,
        signal: controller.signal,
        onToken: (t) => setStreamText((s) => s + t),
      });
      const assistantMsg = await insertMessage({ chat_id: chatId, role: 'assistant', content: result.content, model: 'ksemo-pro', tokens: result.tokens, meta: { latency_ms: result.latencyMs, from_edge: result.fromEdge } });
      if (assistantMsg) setMessages((m) => [...m, assistantMsg]);
      setStreamText('');
      await logUsage('ksemo-pro', estimateTokens(content), result.tokens, result.latencyMs);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const errMsg = await insertMessage({ chat_id: chatId, role: 'assistant', content: `*Something went wrong while generating a response.*\n\nError: ${((err as Error).message)}`, model: 'ksemo-pro' });
        if (errMsg) setMessages((m) => [...m, errMsg]);
      }
    } finally {
      setStreaming(false);
      setStreamText('');
      abortRef.current = null;
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  const toggleRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      playChime(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let baseText = input;
    let finalTranscript = '';

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setInput(baseText + finalTranscript + interim);
    };

    recognition.onstart = () => {
      recognitionRef.current = recognition;
      setRecording(true);
      playChime(true);
    };

    recognition.onend = () => {
      setRecording(false);
      recognitionRef.current = null;
    };

    recognition.onerror = () => {
      setRecording(false);
      recognitionRef.current = null;
    };

    recognition.start();
  };

  const regenerate = async (assistantMsgId: string) => {
    if (streaming) return;
    const idx = messages.findIndex((m) => m.id === assistantMsgId);
    if (idx === -1) return;
    const prevUserMsg = [...messages.slice(0, idx)].reverse().find((m) => m.role === 'user');
    if (!prevUserMsg || !chatId) return;

    await deleteMessage(assistantMsgId);
    setMessages((m) => m.filter((x) => x.id !== assistantMsgId));

    setStreaming(true);
    setStreamText('');
    const controller = new AbortController();
    abortRef.current = controller;

    const msgsUpToUser = messages.slice(0, idx).filter((m) => m.role === 'user' || m.role === 'assistant');
    const history: ChatMessage[] = msgsUpToUser.map((m) => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content }));

    try {
      const result = await streamChat({
        model: chat?.model || 'ksemo-pro',
        messages: history,
        signal: controller.signal,
        onToken: (t) => setStreamText((s) => s + t),
      });
      const assistantMsg = await insertMessage({ chat_id: chatId, role: 'assistant', content: result.content, model: chat?.model || 'ksemo-pro', tokens: result.tokens, meta: { latency_ms: result.latencyMs, from_edge: result.fromEdge, regenerated: true } });
      if (assistantMsg) setMessages((m) => [...m, assistantMsg]);
      setStreamText('');
      await logUsage(chat?.model || 'ksemo-pro', estimateTokens(prevUserMsg.content), result.tokens, result.latencyMs);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const errMsg = await insertMessage({ chat_id: chatId, role: 'assistant', content: `*Failed to regenerate response.*\n\nError: ${((err as Error).message)}`, model: chat?.model || 'ksemo-pro' });
        if (errMsg) setMessages((m) => [...m, errMsg]);
      }
    } finally {
      setStreaming(false);
      setStreamText('');
      abortRef.current = null;
    }
  };

  const saveEdit = async (id: string) => {
    await updateMessage(id, { content: editText });
    setMessages((m) => m.map((x) => x.id === id ? { ...x, content: editText } : x));
    setEditingId(null);

    const idx = messages.findIndex((m) => m.id === id);
    if (idx === -1) return;
    const editedMsg = messages[idx];
    if (editedMsg.role !== 'user') return;

    const nextAssistant = messages.slice(idx + 1).find((m) => m.role === 'assistant');
    if (nextAssistant) {
      regenerate(nextAssistant.id);
    } else {
      setInput(editText);
    }
  };

  const copyMsg = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const shareMsg = async (content: string) => {
    if (navigator.share) {
      try { await navigator.share({ text: content }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(content);
    }
  };

  const saveRename = async () => {
    if (chatId && renameText.trim()) {
      await updateChat(chatId, { title: renameText.trim() });
      setChat((c) => c ? { ...c, title: renameText.trim() } : c);
    }
    setRenameOpen(false);
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center"><div className="h-5 w-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  }

  const composerInner = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        accept="*/*"
      />
      {(deepResearch || webSearch) && (
        <div className="relative z-10 flex items-center gap-2 px-3 pt-1.5 pb-0">
          {deepResearch && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-ink-700 text-ink-100 border border-white/10">
              <Search size={10} /> Deep Research
            </span>
          )}
          {webSearch && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-ink-700 text-ink-100 border border-white/10">
              <Globe size={10} /> Web Search
            </span>
          )}
        </div>
      )}
      <div className="composer-shell">
        <div className="composer-glow" />
        <div className="relative z-10 flex items-end gap-1 px-2 py-2 md:px-3 md:py-2.5">
          <div className="flex items-center gap-0.5 shrink-0 pb-0.5 relative" ref={featureMenuRef}>
            <button className="c-btn" onClick={(e) => { addRipple(e); setFeatureMenuOpen((o) => { if (!o) { const btn = (e.target as HTMLElement).closest('button'); if (btn) { const rect = btn.getBoundingClientRect(); const spaceBelow = window.innerHeight - rect.bottom; setFeatureMenuUp(spaceBelow < 200); } } return !o; }); }} aria-label="More features">
              <Plus size={17} strokeWidth={2.2} className="text-white/70" />
              <span className="c-tip">Features</span>
            </button>
            {featureMenuOpen && (
              <div className={`absolute ${featureMenuUp ? 'bottom-full mb-1 slide-in-from-bottom-1' : 'top-full mt-1 slide-in-from-top-1'} left-1/2 -translate-x-1/2 w-44 bg-ink-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in`}>
                <button onClick={() => { setFeatureMenuOpen(false); handleFileAttach('image/*'); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-white hover:bg-white/5 transition">
                  <Image size={16} /> Photos
                </button>
                <button onClick={() => { setFeatureMenuOpen(false); handleFileAttach('*/*'); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-white hover:bg-white/5 transition">
                  <FileText size={16} /> Files
                </button>
                <button onClick={() => { setFeatureMenuOpen(false); setDeepResearch((v) => !v); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-white hover:bg-white/5 transition">
                  <Search size={16} /> Deep Research
                  {deepResearch && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white" />}
                </button>
                <button onClick={() => { setFeatureMenuOpen(false); setWebSearch((v) => !v); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-white hover:bg-white/5 transition">
                  <Globe size={16} /> Web Search
                  {webSearch && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white" />}
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 relative min-h-[44px] flex items-center">
            {recording ? (
              <div className="flex items-center gap-2 w-full px-1">
                <div className="c-voice-waves text-white/60">
                  <span className="c-voice-wave" />
                  <span className="c-voice-wave" />
                  <span className="c-voice-wave" />
                  <span className="c-voice-wave" />
                  <span className="c-voice-wave" />
                </div>
                <span className="text-[13px] text-white/50 font-medium tracking-wide animate-pulse">Listening…</span>
              </div>
            ) : (
              <>
                {!input && (
                  <div className="absolute left-1 top-1/2 -translate-y-1/2 pointer-events-none z-2 text-[14px] text-ink-400">
                    Ask Ksemo anything…
                  </div>
                )}
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && (prefs.send_on_enter ?? true)) { e.preventDefault(); send(); }
                  }}
                  rows={1}
                  className="w-full bg-transparent px-1 py-2 text-[14px] text-white resize-none focus:outline-none max-h-[120px] scrollbar-hide relative z-10 leading-relaxed"
                  style={{ caretColor: 'var(--color-white)' }}
                />
              </>
            )}
          </div>

          <div className="flex items-center gap-0.5 shrink-0 pb-0.5">
            {(prefs.voice_input_enabled ?? true) && (
              <button
                className={cn('c-btn', recording && 'c-voice-active')}
                onClick={(e) => { addRipple(e); toggleRecording(); }}
                aria-label={recording ? 'Stop recording' : 'Voice input'}
              >
                <Mic size={17} strokeWidth={1.8} />
                <span className="c-tip">{recording ? 'Stop' : 'Voice input'}</span>
              </button>
            )}

            {streaming ? (
              <button
                className="c-btn c-stop"
                onClick={(e) => { addRipple(e); stop(); }}
                aria-label="Stop generation"
              >
                <Square size={14} fill="currentColor" />
                <span className="c-tip">Stop</span>
              </button>
            ) : (
              <button
                className={cn('c-btn c-send', !input.trim() && 'disabled')}
                onClick={(e) => { addRipple(e); send(); }}
                disabled={!input.trim()}
                aria-label="Send message"
              >
                <ArrowUp size={17} strokeWidth={2.5} />
                <span className="c-tip">Send</span>
              </button>
            )}
          </div>
        </div>
      </div>
      <p className="mt-2.5 text-center text-[10.5px] text-ink-400 tracking-wide">
        Ksemo can make mistakes. Check important info.
      </p>
    </>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Chat header — only when messages exist */}
      {!isEmpty && (
        <div className="h-14 px-4 border-b border-white/8 flex items-center gap-3 glass shrink-0">
          <button onClick={() => setRenameOpen(true)} className="flex items-center gap-2 min-w-0 group">
            <span className="text-[14px] font-medium text-white truncate max-w-[200px] md:max-w-xs">{chat?.title || 'Chat'}</span>
            <Pencil size={12} className="text-ink-300 opacity-0 group-hover:opacity-100 transition" />
          </button>

          <div className="flex items-center gap-1.5 ml-auto">
            <button 
              onClick={() => setShareOpen(true)}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-200 hover:bg-white/5 hover:text-white transition"
              title="Share chat"
            >
              <Share2 size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Empty state — centered greeting + composer (same width as message view) */}
      {isEmpty && (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 md:px-6">
          <div className="w-full max-w-3xl flex flex-col items-center text-center animate-fade-in">
            <div className="h-12 w-12 rounded-2xl bg-ink-800 border border-white/10 flex items-center justify-center mb-6">
              <span className="font-bold text-white text-[22px]">K</span>
            </div>
            <h1 className="text-[20px] md:text-[24px] font-semibold text-white tracking-tight leading-tight mb-8">
              {getTimeOfDayGreeting(firstName)}
            </h1>

            <div className="w-full">
              {(deepResearch || webSearch) && (
                <div className="flex items-center gap-2 px-3 pb-1">
                  {deepResearch && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-ink-700 text-ink-100 border border-white/10">
                      <Search size={10} /> Deep Research
                    </span>
                  )}
                  {webSearch && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-ink-700 text-ink-100 border border-white/10">
                      <Globe size={10} /> Web Search
                    </span>
                  )}
                </div>
              )}
              <div className="composer-shell">
                <div className="composer-glow" />
                <div className="relative z-10 flex items-end gap-1 px-2 py-2 md:px-3 md:py-2.5">
                  {(prefs.file_attachment_enabled ?? true) && (
                    <div className="flex items-center gap-0.5 shrink-0 pb-0.5 relative" ref={featureMenuRef}>
                      <button className="c-btn" onClick={(e) => { addRipple(e); setFeatureMenuOpen((o) => { if (!o) { const btn = (e.target as HTMLElement).closest('button'); if (btn) { const rect = btn.getBoundingClientRect(); const spaceBelow = window.innerHeight - rect.bottom; setFeatureMenuUp(spaceBelow < 200); } } return !o; }); }} aria-label="More features">
                        <Plus size={17} strokeWidth={2.2} className="text-white/70" />
                        <span className="c-tip">Features</span>
                      </button>
                      {featureMenuOpen && (
                        <div className={`absolute ${featureMenuUp ? 'bottom-full mb-1 slide-in-from-bottom-1' : 'top-full mt-1 slide-in-from-top-1'} left-1/2 -translate-x-1/2 w-44 bg-ink-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in`}>
                          <button onClick={() => { setFeatureMenuOpen(false); handleFileAttach('image/*'); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-white hover:bg-white/5 transition">
                            <Image size={16} /> Photos
                          </button>
                          <button onClick={() => { setFeatureMenuOpen(false); handleFileAttach('*/*'); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-white hover:bg-white/5 transition">
                            <FileText size={16} /> Files
                          </button>
                          <button onClick={() => { setFeatureMenuOpen(false); setDeepResearch((v) => !v); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-white hover:bg-white/5 transition">
                            <Search size={16} /> Deep Research
                            {deepResearch && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white" />}
                          </button>
                          <button onClick={() => { setFeatureMenuOpen(false); setWebSearch((v) => !v); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-white hover:bg-white/5 transition">
                            <Globe size={16} /> Web Search
                            {webSearch && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white" />}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex-1 relative min-h-[44px] flex items-center">
                    {recording ? (
                      <div className="flex items-center gap-2 w-full px-1">
                        <div className="c-voice-waves text-white/60">
                          <span className="c-voice-wave" /><span className="c-voice-wave" /><span className="c-voice-wave" /><span className="c-voice-wave" /><span className="c-voice-wave" />
                        </div>
                        <span className="text-[13px] text-white/50 font-medium tracking-wide animate-pulse">Listening...</span>
                      </div>
                    ) : (
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && (prefs.send_on_enter ?? true)) { e.preventDefault(); send(); } }}
                        rows={1}
                        placeholder="Ask Ksemo anything..."
                        className="w-full bg-transparent px-1 py-2 text-[14px] text-white placeholder:text-ink-400 resize-none focus:outline-none max-h-[120px] scrollbar-hide relative z-10 leading-relaxed"
                  style={{ caretColor: 'var(--color-white)' }}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0 pb-0.5">
                    {(prefs.voice_input_enabled ?? true) && (
                      <button className={cn('c-btn', recording && 'c-voice-active')} onClick={(e) => { addRipple(e); toggleRecording(); }} aria-label={recording ? 'Stop recording' : 'Voice input'}>
                        <Mic size={17} strokeWidth={1.8} />
                        <span className="c-tip">{recording ? 'Stop' : 'Voice input'}</span>
                      </button>
                    )}
                    <button className={cn('c-btn c-send', !input.trim() && 'disabled')} onClick={(e) => { addRipple(e); send(); }} disabled={!input.trim()} aria-label="Send message">
                      <ArrowUp size={17} strokeWidth={2.5} />
                      <span className="c-tip">Send</span>
                    </button>
                  </div>
                </div>
              </div>
              <p className="mt-2.5 text-center text-[10.5px] text-ink-400 tracking-wide">Ksemo can make mistakes. Check important info.</p>
            </div>
          </div>
        </div>
      )}

      {/* Messages — scrolled content */}
      {!isEmpty && (
        <div className="flex-1 min-h-0 flex">
          <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  m={m}
                  isUser={m.role === 'user'}
                  editing={editingId === m.id}
                  editText={editText}
                  onEditStart={() => { setEditingId(m.id); setEditText(m.content); }}
                  onEditCancel={() => setEditingId(null)}
                  onEditSave={() => saveEdit(m.id)}
                  onEditText={setEditText}
                  onCopy={() => copyMsg(m.content)}
                  onShare={() => shareMsg(m.content)}
                  onDelete={() => {
                    setConfirmDeleteMessageId(m.id);
                  }}
                  onRegenerate={() => regenerate(m.id)}
                  onToggleFavorite={async () => {
                    const fav = await isFavorite(m.id);
                    if (fav) { await removeFavorite(m.id); } else { await addFavorite(m.id); }
                  }}
                  checkFavorite={isFavorite}
                  showTokenCount={prefs.show_token_count ?? false}
                  readAloudEnabled={prefs.read_aloud_enabled ?? true}
                />
              ))}

              {streaming && streamText && (
                <div className="flex gap-3 animate-fade-in">
                  <Avatar />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[12px] font-medium text-white">Ksemo</span>
                      <span className="text-[11px] text-ink-300 flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse-soft" /> generating</span>
                    </div>
                    <Markdown content={streamText} className="typing-caret" />
                  </div>
                </div>
              )}
              {streaming && !streamText && (
                <div className="flex gap-3 animate-fade-in">
                  <Avatar />
                  <div className="flex items-center gap-1.5 h-8">
                    <span className="h-2 w-2 rounded-full bg-white/60 animate-pulse-soft" />
                    <span className="h-2 w-2 rounded-full bg-white/60 animate-pulse-soft" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 rounded-full bg-white/60 animate-pulse-soft" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Composer — pinned bottom when messages exist */}
      {!isEmpty && (
        <div className="px-3 md:px-6 pb-4 md:pb-6 pt-2 shrink-0">
          <div className="max-w-3xl mx-auto">
            {composerInner}
          </div>
        </div>
      )}

      {/* Rename modal */}
      <Modal open={renameOpen} onClose={() => setRenameOpen(false)} title="Rename chat" size="sm"
        footer={<><Button variant="ghost" size="sm" onClick={() => setRenameOpen(false)}>Cancel</Button><Button size="sm" onClick={saveRename}>Save</Button></>}>
        <Textarea value={renameText} onChange={(e) => setRenameText(e.target.value)} rows={2} onKeyDown={(e) => { if (e.key === 'Enter') saveRename(); }} />
      </Modal>

      {/* Delete confirmation modal */}
      {confirmDeleteMessageId && (
        <Modal
          open={!!confirmDeleteMessageId}
          onClose={() => setConfirmDeleteMessageId(null)}
          title="Delete Message"
          size="sm"
          footer={
            <>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteMessageId(null)}>
                Cancel
              </Button>
              <Button 
                variant="danger" 
                size="sm" 
                onClick={async () => {
                  if (confirmDeleteMessageId) {
                    await deleteMessage(confirmDeleteMessageId);
                    setMessages((msgs) => msgs.filter((x) => x.id !== confirmDeleteMessageId));
                  }
                  setConfirmDeleteMessageId(null);
                }}
              >
                Delete
              </Button>
            </>
          }
        >
          <div className="text-[13px] text-ink-200 leading-relaxed">
            Are you sure you want to permanently delete this message? This action cannot be undone.
          </div>
        </Modal>
      )}

      {chat && (
        <ShareModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          chat={chat}
        />
      )}
    </div>
  );
}

function Avatar() {
  return (
    <div className="h-8 w-8 rounded-xl bg-ink-800 border border-white/10 flex items-center justify-center shrink-0">
      <span className="font-bold text-white text-[13px]">K</span>
    </div>
  );
}

function ActionBarBtn({ icon, tooltip, onClick, active }: {
  icon: React.ReactNode;
  tooltip: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'msg-action-btn h-7 w-7 rounded-lg flex items-center justify-center transition-all duration-200',
        active ? 'text-white bg-white/10' : 'text-ink-300 hover:text-white hover:bg-white/8',
      )}
      aria-label={tooltip}
    >
      {icon}
      <span className="msg-tooltip">{tooltip}</span>
    </button>
  );
}

function MessageBubble({ m, isUser, editing, editText, onEditStart, onEditCancel, onEditSave, onEditText, onCopy, onShare, onDelete, onRegenerate, onToggleFavorite, checkFavorite, showTokenCount, readAloudEnabled }: {
  m: Message; isUser: boolean; editing: boolean; editText: string;
  onEditStart: () => void; onEditCancel: () => void; onEditSave: () => void; onEditText: (v: string) => void;
  onCopy: () => void; onShare: () => void; onDelete: () => void; onRegenerate: () => void;
  onToggleFavorite: () => void; checkFavorite: (messageId: string) => Promise<boolean>;
  showTokenCount?: boolean; readAloudEnabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isUser) {
      checkFavorite(m.id).then(setFavorited).catch(() => {});
    }
  }, [m.id, isUser, checkFavorite]);

  const toggleFavorite = async () => {
    await onToggleFavorite();
    setFavorited((f) => !f);
  };

  const copy = () => { onCopy(); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const share = () => { onShare(); setShared(true); setTimeout(() => setShared(false), 2000); };

  const readAloud = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(m.content);
      u.rate = 0.95;
      u.pitch = 0.85;
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => /daniel|alex|james|matthew|thomas|google.*male|google.*gb|en-gb.*male/i.test(v.name) && v.lang.startsWith('en'))
        || voices.find(v => /david|mark|richard|daniel|google.*english|samantha|en-us/i.test(v.name) && v.lang.startsWith('en'))
        || voices.find(v => v.lang.startsWith('en') && /male|man|guy/i.test(v.name))
        || voices.find(v => v.lang.startsWith('en'));
      if (preferred) u.voice = preferred;
      u.onstart = () => setReading(true);
      u.onend = () => setReading(false);
      u.onerror = () => setReading(false);
      window.speechSynthesis.speak(u);
    }
  };
  const stopReading = () => { window.speechSynthesis?.cancel(); setReading(false); };

  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [moreOpen]);

  return (
    <div className={cn('group flex gap-3 animate-fade-in', isUser && 'flex-row-reverse')}>
        {!isUser && <Avatar />}
        <div className={cn('flex-1 min-w-0', isUser ? 'max-w-[50%] flex flex-col items-end' : 'max-w-[90%]')}>
          {!isUser && (
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[12px] font-medium text-white">Ksemo</span>
              {showTokenCount && m.tokens != null && m.tokens > 0 && (
                <span className="text-[10px] text-ink-400">{m.tokens} tokens</span>
              )}
            </div>
          )}
        {editing ? (
          <div className="space-y-2">
            <Textarea value={editText} onChange={(e) => onEditText(e.target.value)} rows={4} autoFocus />
            <div className="flex gap-2">
              <Button size="sm" onClick={onEditSave}>Save</Button>
              <Button size="sm" variant="ghost" onClick={onEditCancel}>Cancel</Button>
            </div>
          </div>
        ) : (
          isUser ? (
            <div className="rounded-2xl px-4 py-3 bg-white/10 border border-white/8 break-words overflow-hidden">
              <Markdown content={m.content} />
            </div>
          ) : (
            <div className="break-words overflow-hidden">
              <Markdown content={m.content} />
            </div>
          )
        )}

        {!editing && isUser && (
          <div className="mt-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-row-reverse">
            <ActionBarBtn icon={<Pencil size={14} />} tooltip="Edit" onClick={onEditStart} />
            <ActionBarBtn
              icon={copied ? <Check size={14} /> : <Copy size={14} />}
              tooltip={copied ? 'Copied' : 'Copy'}
              onClick={copy} active={copied}
            />
            <ActionBarBtn
              icon={shared ? <Check size={14} /> : <Share2 size={14} />}
              tooltip={shared ? 'Copied for sharing' : 'Share'}
              onClick={share} active={shared}
            />
          </div>
        )}

        {!editing && !isUser && (
          <div className="mt-1.5 flex items-center gap-0.5">
            <ActionBarBtn
              icon={copied ? <Check size={14} /> : <Copy size={14} />}
              tooltip={copied ? 'Copied' : 'Copy'}
              onClick={copy} active={copied}
            />
            <ActionBarBtn
              icon={shared ? <Check size={14} /> : <Share2 size={14} />}
              tooltip={shared ? 'Copied for sharing' : 'Share'}
              onClick={share} active={shared}
            />
            <ActionBarBtn
              icon={<Star size={14} className={favorited ? 'fill-white' : ''} />}
              tooltip={favorited ? 'Unfavorite' : 'Favorite'}
              onClick={toggleFavorite} active={favorited}
            />
            <ActionBarBtn icon={<RotateCw size={14} />} tooltip="Regenerate" onClick={onRegenerate} />
            <div className="relative" ref={moreRef}>
              <ActionBarBtn
                icon={<MoreHorizontal size={14} />}
                tooltip="More"
                onClick={() => setMoreOpen(!moreOpen)}
              />
              {moreOpen && (
                <div className="msg-more-menu open">
                  {readAloudEnabled !== false && (
                    <button onClick={() => { reading ? stopReading() : readAloud(); setMoreOpen(false); }}>
                      <Volume2 size={14} /> {reading ? 'Stop reading' : 'Read aloud'}
                    </button>
                  )}
                  <button className="danger" onClick={() => { onDelete(); setMoreOpen(false); }}>
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
