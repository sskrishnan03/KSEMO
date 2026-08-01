import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Mic, MicOff, X, Share2, Copy, RefreshCw, MoreHorizontal, Trash2, Volume2, Check } from 'lucide-react';
import { cn, estimateTokens } from '../lib/utils';
import { useTheme } from '../components/ThemeProvider';
import { useAuthContext } from '../components/AuthProvider';
import { createVoiceChat, insertMessage, updateChat, updateMessage, deleteMessage, getSettings, logUsage, listChats, listMessages, setLastActiveChatId } from '../lib/data';
import { streamChat, type ChatMessage } from '../lib/ai';
import { Markdown } from '../components/Markdown';
import { ShareModal } from '../components/ShareModal';
import type { Chat } from '../lib/types';

type HistoryEntry = { id?: string; role: 'user' | 'assistant'; content: string };

function MessageActionButton({ title, onClick, danger, children }: { title: string; onClick: (e: React.MouseEvent) => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => onClick(e)}
      className={cn(
        'h-5 w-5 rounded-full flex items-center justify-center transition',
        danger ? 'text-red-400 hover:bg-red-500/15 hover:text-red-300' : 'text-ink-300 hover:text-white hover:bg-white/10'
      )}
    >
      {children}
    </button>
  );
}

type VoiceState = 'listening' | 'thinking' | 'speaking' | 'error' | 'reconnecting';

const RECONNECT_DELAY_MS = 1500;
const MAX_RECONNECT_ATTEMPTS = 5;

// Helper to strip Markdown formatting so TTS does not crash or stay silent
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks completely
    .replace(/`([^`]+)`/g, '$1') // Remove inline code backticks
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold asterisks
    .replace(/\*([^*]+)\*/g, '$1') // Remove italic asterisks
    .replace(/#+\s+/g, '') // Remove headers
    .replace(/-\s+/g, '') // Remove bullet dashes
    .replace(/^\s*\d+\.\s+/gm, '') // Remove list numbers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove markdown links, keep text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .trim();
}

export default function VoiceChat() {
  const nav = useNavigate();
  const loc = useLocation();
  const { chatId: routeChatId } = useParams<{ chatId?: string }>();
  const { resolvedTheme } = useTheme();
  const { profile } = useAuthContext();
  const [state, setState] = useState<VoiceState>('listening');
  const [muted, setMuted] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [chatId, setChatId] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [aiResponseText, setAiResponseText] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [shareChat, setShareChat] = useState<Chat | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [moreMenuIndex, setMoreMenuIndex] = useState<number | null>(null);
  const [moreMenuPos, setMoreMenuPos] = useState<{ left: number; bottom: number } | null>(null);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [readAloudEnabled, setReadAloudEnabled] = useState(true);
  const [liveUserText, setLiveUserText] = useState('');

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const isSpeechSupported = !!SpeechRecognition;

  const [hasKey, setHasKey] = useState(() => {
    return !!(import.meta.env.VITE_OPENROUTER_API_KEY || localStorage.getItem('ksemo_openrouter_api_key'));
  });
  const [apiKeyInput, setApiKeyInput] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const abortRef = useRef<AbortController | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const conversationRef = useRef<ChatMessage[]>([]);
  const stateRef = useRef<VoiceState>('listening');
  const mutedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const exchangesRef = useRef(0);
  const totalTokensRef = useRef(0);
  const chatIdRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const processingRef = useRef(false);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const continueRef = useRef(false);
  const isContinue = !!routeChatId;

  // Continue mode = an existing chat was opened from the sidebar.
  useEffect(() => { continueRef.current = !!routeChatId; }, [routeChatId]);

  // Connect read-aloud availability to the user's Settings preference.
  useEffect(() => {
    if (!profile?.id) return;
    getSettings(profile.id).then((s) => {
      setReadAloudEnabled(s?.preferences?.read_aloud_enabled ?? true);
    }).catch(() => {});
  }, [profile?.id]);

  // Sync state and muted to refs for the callbacks
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { chatIdRef.current = chatId; }, [chatId]);
  useEffect(() => { startedRef.current = started; }, [started]);

  const voiceLevelRef = useRef(0);
  useEffect(() => { voiceLevelRef.current = voiceLevel; }, [voiceLevel]);

  const saveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;
    localStorage.setItem('ksemo_openrouter_api_key', apiKeyInput.trim());
    setHasKey(true);
    stopAll();
    setStarted(false);
  };

  // Get or create mic stream
  const getMicStream = useCallback(async (): Promise<MediaStream> => {
    if (streamRef.current && streamRef.current.active) return streamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 16000,
      },
    });
    streamRef.current = stream;
    return stream;
  }, []);

  // Voice level analyser
  const startAnalyser = useCallback(async () => {
    try {
      const stream = await getMicStream();
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      analyserRef.current = analyser;
    } catch (e) {
      console.error('Mic permission denied or audio issue:', e);
      stateRef.current = 'error';
      setState('error');
    }
  }, [getMicStream]);

  const stopAnalyser = useCallback(() => {
    analyserRef.current = null;
    setVoiceLevel(0);
  }, []);

  // TTS with local service preference, queue unsticking, and safety timeout
  const speak = useCallback((text: string, onWordBoundary?: (spokenText: string) => void): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) { resolve(false); return; }
      
      try { window.speechSynthesis.cancel(); } catch {}
      try { window.speechSynthesis.resume(); } catch {} // Unpause Chrome's audio queue
      
      const u = new SpeechSynthesisUtterance(text);
      utteranceRef.current = u; // Prevent garbage collection
      
      u.rate = continueRef.current ? 0.82 : 0.92;
      u.pitch = 0.9;
      u.volume = 0.85;
      
      const voices = window.speechSynthesis.getVoices();
      const enVoices = voices.filter(v => v.lang.startsWith('en'));
      // Prefer offline local service voices (prevents silent failures from network-based cloud voices)
      const localEnVoices = enVoices.filter(v => v.localService);
      const candidates = localEnVoices.length > 0 ? localEnVoices : enVoices;

      const preferred = candidates.find(v => /daniel|alex|james|matthew|thomas|google.*male|google.*gb|en-gb.*male/i.test(v.name))
        || candidates.find(v => /david|mark|richard|daniel|google.*english|samantha|en-us/i.test(v.name))
        || candidates[0];

      if (preferred) {
        u.voice = preferred;
        console.log("TTS voice selected:", preferred.name, "LocalService:", preferred.localService);
      }

      let resolved = false;
      const done = () => {
        if (resolved) return;
        resolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        utteranceRef.current = null;
        resolve(false);
      };

      u.onend = done;
      u.onerror = done;

      if (onWordBoundary) {
        u.onboundary = (event: any) => {
          if (event.name === 'word') {
            const charIndex = event.charIndex;
            const remaining = text.slice(charIndex);
            const nextSpace = remaining.search(/\s/);
            const wordEnd = nextSpace === -1 ? text.length : charIndex + nextSpace;
            onWordBoundary(text.slice(0, wordEnd));
          }
        };
      }

      // Safety timeout: 250ms per word + 4 seconds padding
      const wordCount = text.split(/\s+/).length;
      const timeoutMs = Math.max(5000, wordCount * 250 + 4000);
      const timeoutId = setTimeout(() => {
        console.warn("TTS speak timeout triggered");
        try { window.speechSynthesis.cancel(); } catch {}
        done();
      }, timeoutMs);

      window.speechSynthesis.speak(u);
    });
  }, []);

  // Process user speech → AI → TTS → listen again
  const processUserSpeech = useCallback(async (text: string) => {
    if (processingRef.current) return;
    if (!text.trim() || !chatIdRef.current) return;
    processingRef.current = true;

    stateRef.current = 'thinking';
    setState('thinking');
    try { recognitionRef.current?.stop(); } catch {}

    conversationRef.current.push({ role: 'user', content: text });
    const userMsg = await insertMessage({ chat_id: chatIdRef.current, role: 'user', content: text });
    setHistory((h) => [...h, { id: userMsg?.id ?? undefined, role: 'user', content: text }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await streamChat({
        model: 'ksemo-pro',
        messages: [...conversationRef.current],
        signal: controller.signal,
        onToken: () => {},
      });

      if (controller.signal.aborted) return;

      conversationRef.current.push({ role: 'assistant', content: result.content });
      exchangesRef.current += 1;
      totalTokensRef.current += result.tokens;

      const aiMsg = await insertMessage({ chat_id: chatIdRef.current, role: 'assistant', content: result.content, model: 'ksemo-pro', tokens: result.tokens });
      await logUsage('ksemo-pro', estimateTokens(text), result.tokens, result.latencyMs);
      setHistory((h) => [...h, { id: aiMsg?.id ?? undefined, role: 'assistant', content: result.content }]);

      stateRef.current = 'speaking';
      setState('speaking');
      setLiveUserText(''); // Clear the recognized user text once the AI starts replying
      setAiResponseText(''); // Start with empty subtitles
      
      const plainText = stripMarkdown(result.content);
      await speak(plainText, (spokenText) => {
        setAiResponseText(spokenText);
      }); // Play audio and reveal text word-by-word
      setAiResponseText(plainText); // Ensure full text is displayed when finished

      if (stateRef.current === 'speaking') {
        stateRef.current = 'listening';
        setState('listening');
        setAiResponseText(''); // Clear subtitles when speaking completes
        startRecognition();
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        stateRef.current = 'listening';
        setState('listening');
        startRecognition();
        return;
      }
      console.error('Voice chat error:', err);
      stateRef.current = 'error';
      setState('error');
      await new Promise((r) => setTimeout(r, RECONNECT_DELAY_MS));
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current += 1;
        stateRef.current = 'reconnecting';
        setState('reconnecting');
        await new Promise((r) => setTimeout(r, 500));
        stateRef.current = 'listening';
        setState('listening');
        startRecognition();
      }
    } finally {
      processingRef.current = false;
    }
  }, [speak]);

  // Start speech recognition
  const startRecognition = useCallback(() => {
    if (mutedRef.current || stateRef.current !== 'listening' || !isSpeechSupported) return;

    try { recognitionRef.current?.stop(); } catch { /* ok */ }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log("Speech recognition session started successfully");
    };

    recognition.onresult = (event: any) => {
      if (recognitionRef.current !== recognition) return; // Ignore events from old instances
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      const text = transcript.trim();
      if (!text || processingRef.current) return;
      reconnectAttemptsRef.current = 0;
      setLiveUserText(text);
      stateRef.current = 'thinking';
      setState('thinking');
      try { recognition.stop(); } catch { /* ok */ }
      processUserSpeech(text);
    };

    recognition.onend = () => {
      console.log("Speech recognition session ended. State:", stateRef.current);
      if (stateRef.current === 'listening' && !mutedRef.current && recognitionRef.current === recognition) {
        try { recognition.start(); } catch { /* already started */ }
      }
    };

    recognition.onerror = (e: any) => {
      console.error("Speech recognition error:", e.error, e.message);
      if (e.error === 'not-allowed') {
        stateRef.current = 'error';
        setState('error');
        return;
      }
      if (e.error === 'aborted') {
        return; // Don't restart if aborted
      }
      if (stateRef.current === 'listening' && !mutedRef.current && recognitionRef.current === recognition) {
        setTimeout(() => {
          if (stateRef.current === 'listening' && !mutedRef.current && recognitionRef.current === recognition) {
            try { recognition.start(); } catch { /* ok */ }
          }
        }, 250);
      }
    };

    recognitionRef.current = recognition;
    try { recognition.start(); } catch { /* ok */ }
  }, [processUserSpeech, isSpeechSupported]);

  const stopAll = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { /* ok */ }
    recognitionRef.current = null;
    stopAnalyser();
    window.speechSynthesis?.cancel();
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, [stopAnalyser]);

  // Click gesture handler to boot up WebAudio and speech engine
  const startSessionFlow = async () => {
    if (startedRef.current) return;
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
      const unlockUtterance = new SpeechSynthesisUtterance(" ");
      unlockUtterance.volume = 0;
      window.speechSynthesis.speak(unlockUtterance);
    } catch (e) {
      console.warn("Failed to unlock speech synthesis:", e);
    }

    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }
    } catch (err) {
      console.error('AudioContext gesture initialize error:', err);
    }

    setStarted(true);
    stateRef.current = 'listening';
    setState('listening');

    if (!chatIdRef.current) {
      // Fresh session: reuse an existing empty chat (like "New chat") so we don't pile up unused ones
      const chats = await listChats();
      const existingEmpty = chats.find((c) => c.title === 'New chat');
      const c = existingEmpty ?? (await createVoiceChat());
      if (!c) return;
      setChatId(c.id);
      setLastActiveChatId(c.id);
      conversationRef.current = [];
      window.dispatchEvent(new CustomEvent('ksemo-chats-updated'));
    }
    exchangesRef.current = 0;
    totalTokensRef.current = 0;
    reconnectAttemptsRef.current = 0;
    await startAnalyser();
    startRecognition();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopAll(); };
  }, []);

  // On route change: reset, and if a specific chat is opened, load its conversation
  // so the AI has context. The screen looks and behaves exactly like a normal voice chat.
  useEffect(() => {
    let cancelled = false;
    const setup = async () => {
      stopAll();
      setStarted(false);
      stateRef.current = 'listening';
      setState('listening');
      setAiResponseText('');
      setLiveUserText('');
      conversationRef.current = [];
      setHistory([]);
      setChatId(routeChatId ?? null);
      if (routeChatId) {
        setLastActiveChatId(routeChatId);
        const msgs = await listMessages(routeChatId);
        if (cancelled) return;
        const loaded: HistoryEntry[] = msgs
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content }));
        conversationRef.current = loaded;
        setHistory(loaded);
      }
    };
    setup();
    return () => { cancelled = true; };
  }, [routeChatId, stopAll]);

  // Keep the saved-chat transcript scrolled to the newest message
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history]);

  // End session → save the conversation title, reset, and return to the normal voice chat screen.
  const endSession = useCallback(async () => {
    stopAll();
    setStarted(false);
    setLiveUserText('');


    if (chatIdRef.current && conversationRef.current.length > 0) {
      const firstUser = conversationRef.current.find((m) => m.role === 'user');
      const title = firstUser
        ? firstUser.content.slice(0, 48) + (firstUser.content.length > 48 ? '…' : '')
        : 'Voice Chat';
      await updateChat(chatIdRef.current, { title });
      window.dispatchEvent(new CustomEvent('ksemo-chats-updated'));
    }

    if (routeChatId) {
      // Ended a continued session → reload the saved conversation so the
      // text-only view shows the latest messages and can be continued again.
      const msgs = await listMessages(routeChatId);
      const loaded: HistoryEntry[] = msgs
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content }));
      conversationRef.current = loaded;
      setHistory(loaded);
      setChatId(routeChatId);
      chatIdRef.current = routeChatId;
      exchangesRef.current = 0;
      totalTokensRef.current = 0;
      reconnectAttemptsRef.current = 0;
      return;
    }

    chatIdRef.current = null;
    setChatId(null);
    conversationRef.current = [];
    exchangesRef.current = 0;
    totalTokensRef.current = 0;
    reconnectAttemptsRef.current = 0;

    if (loc.pathname.startsWith('/app/voice-chat/')) {
      nav('/app/voice-chat', { replace: true });
    }
  }, [nav, stopAll, loc.pathname, routeChatId]);

  // Share the currently active chat
  const handleShareActive = async () => {
    if (!chatId) return;
    try {
      const all = await listChats();
      const c = all.find((x) => x.id === chatId);
      if (c) setShareChat(c);
    } catch { /* ignore */ }
  };

  // Copy a message to the clipboard
  const handleCopyMessage = async (index: number, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex((i) => (i === index ? null : i)), 1500);
    } catch { /* ignore */ }
  };

  // Read a single AI message aloud
  const handleReadAloud = (content: string) => {
    window.speechSynthesis?.cancel();
    speak(stripMarkdown(content));
  };

  // Regenerate an AI response: drop that response, rebuild context up to it, and re-ask
  const handleRegenerate = async (index: number) => {
    const target = history[index];
    if (!target || target.role !== 'assistant' || !chatIdRef.current) return;
    if (processingRef.current) return;
    processingRef.current = true;
    setRegeneratingIndex(index);

    // Everything before this AI message becomes the prompt context
    const prefix = history.slice(0, index).map((m) => ({ role: m.role, content: m.content }));
    conversationRef.current = prefix;

    try {
      const controller = new AbortController();
      abortRef.current = controller;
      const result = await streamChat({
        model: 'ksemo-pro',
        messages: [...conversationRef.current],
        signal: controller.signal,
        onToken: () => {},
      });
      if (controller.signal.aborted) return;

      conversationRef.current = [...prefix, { role: 'assistant', content: result.content }];
      setHistory((h) => h.map((m, i) => (i === index ? { ...m, content: result.content } : m)));
      if (target.id) await updateMessage(target.id, { content: result.content });
      await logUsage('ksemo-pro', estimateTokens(prefix.map((m) => typeof m.content === 'string' ? m.content : '').join(' ')), result.tokens, result.latencyMs);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Regenerate failed:', err);
        stateRef.current = 'error';
        setState('error');
      }
    } finally {
      processingRef.current = false;
      setRegeneratingIndex(null);
    }
  };

  // Delete a single message from the conversation
  const handleDeleteMessage = async (index: number) => {
    const target = history[index];
    if (!target) return;
    if (target.id) await deleteMessage(target.id);
    const next = history.filter((_, i) => i !== index);
    setHistory(next);
    conversationRef.current = next.map((m) => ({ role: m.role, content: m.content }));
    setMoreMenuIndex(null);
  };

  // Mute / Unmute handler
  useEffect(() => {
    if (muted) {
      try { recognitionRef.current?.stop(); } catch {}
      window.speechSynthesis?.cancel();
    } else {
      if (stateRef.current === 'listening') {
        startRecognition();
      }
    }
  }, [muted, startRecognition]);

  // Real-time amplitude loop (drives the wobbly circle with the live mic level)
  useEffect(() => {
    if (!hasKey) return;
    let animFrame: number;
    let time = 0;
    const dataArray = new Uint8Array(128);

    const loop = () => {
      time += 1;
      let level = 0;

      // Calculate the active sound amplitude level
      if (started) {
        if (stateRef.current === 'listening') {
          if (analyserRef.current) {
            analyserRef.current.getByteFrequencyData(dataArray);
            level = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;
          }
        } else if (stateRef.current === 'speaking') {
          const sim = 0.05 + Math.abs(Math.sin(time * 0.14) * Math.cos(time * 0.06)) * 0.38;
          const isPause = Math.sin(time * 0.035) < -0.65;
          level = isPause ? 0.01 : sim;
        } else if (stateRef.current === 'thinking') {
          level = 0.01 + Math.abs(Math.sin(time * 0.08)) * 0.03;
        }
      }

      setVoiceLevel(level);
      animFrame = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(animFrame);
  }, [hasKey, started]);

  // Canvas Fluid Circle Renderer (fresh voice chat only)
  useEffect(() => {
    if (!hasKey) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;
    let time = 0;

    const render = () => {
      time += 1;
      const level = voiceLevelRef.current;

      // Resize canvas dynamically to match client size
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.clearRect(0, 0, w, h);

      // Circle Base Sizing
      let baseRadius = Math.min(w, h) * 0.38;
      if (baseRadius < 110) baseRadius = 110;

      // Draw the wobbly organic pure black circle (Fibbler edges)
      const numPoints = 120;
      ctx.beginPath();

      for (let i = 0; i <= numPoints; i++) {
        const theta = (i / numPoints) * Math.PI * 2;
        
        // Multi-frequency wave layers for a liquid organic "wobble"
        const w1 = Math.sin(theta * 4 + time * 0.04) * 5;
        const w2 = Math.cos(theta * 7 - time * 0.10) * (3 + level * 28);
        const w3 = Math.sin(theta * 13 + time * 0.07) * (1.5 + level * 14);

        const r = baseRadius + w1 + w2 + w3;
        const x = w / 2 + Math.cos(theta) * r;
        const y = h / 2 + Math.sin(theta) * r;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.closePath();
      
      // Pure black solid fill (no stroke border line)
      ctx.fillStyle = resolvedTheme === 'light' ? '#2d2a27' : '#000000';
      ctx.fill();

      animFrame = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animFrame);
  }, [hasKey, resolvedTheme, started]);

  if (!hasKey) {
    return (
      <div className="min-h-screen bg-ink-900 text-white flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-ink-850 border border-white/5 rounded-2xl p-6 space-y-6 text-center shadow-glow">
          <div className="mx-auto w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white">
            <Mic size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white mb-2">OpenRouter API Key Required</h2>
            <p className="text-xs text-ink-300 leading-relaxed">
              The Voice Assistant requires an OpenRouter API key to converse with you. Your key will be saved safely in your browser local storage.
            </p>
          </div>
          <form onSubmit={saveApiKey} className="flex flex-col gap-3.5">
            <input
              type="password"
              placeholder="sk-or-v1-..."
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl bg-ink-900 border border-white/10 text-white focus:outline-none focus:border-white/20 text-sm placeholder:text-ink-400 focus:ring-1 focus:ring-white/20 transition-all"
              required
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => nav('/app')}
                className="flex-1 h-11 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm transition font-medium border border-white/10"
              >
                Back to App
              </button>
              <button
                type="submit"
                className="flex-1 h-11 rounded-xl bg-ink-800 text-white border border-white/10 hover:bg-ink-700 active:bg-ink-750 transition font-semibold"
              >
                Save & Connect
              </button>
            </div>
          </form>
          <p className="text-[10px] text-ink-400">
            Get an API key at <a href="https://openrouter.ai/" target="_blank" rel="noreferrer" className="text-white/60 hover:text-white hover:underline transition">openrouter.ai</a>
          </p>
        </div>
      </div>
    );
  }

  const openMoreMenu = (e: React.MouseEvent, i: number) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMoreMenuPos({ left: rect.left, bottom: window.innerHeight - rect.top });
    setMoreMenuIndex(i);
  };

  const renderMessages = () => (
    <div className="space-y-4">
      {history.map((h, i) => {
        const isUser = h.role === 'user';
        const isCopied = copiedIndex === i;
        const isRegenerating = regeneratingIndex === i;
        return (
          <div key={i} className="group">
            <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[88%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed',
                  isUser
                    ? 'bg-white/10 border border-white/10 text-white rounded-br-md'
                    : 'bg-ink-800 border border-white/8 text-ink-100 rounded-bl-md'
                )}
              >
                {h.role === 'assistant' ? (
                  <Markdown content={h.content} />
                ) : (
                  <span className="whitespace-pre-wrap">{h.content}</span>
                )}
              </div>
            </div>

            {/* Message action row (revealed on hover) */}
            <div className={cn('flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity', isUser ? 'justify-end' : 'justify-start')}>
              <MessageActionButton title="Copy" onClick={() => handleCopyMessage(i, h.content)}>
                {isCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </MessageActionButton>

              {!isUser && (
                <MessageActionButton title={isRegenerating ? 'Regenerating…' : 'Regenerate'} onClick={() => handleRegenerate(i)}>
                  <RefreshCw size={12} className={isRegenerating ? 'animate-spin' : ''} />
                </MessageActionButton>
              )}

              <MessageActionButton title="Share chat" onClick={handleShareActive}>
                <Share2 size={12} />
              </MessageActionButton>

              {!isUser && (
                <MessageActionButton title="More options" onClick={(e) => openMoreMenu(e, i)}>
                  <MoreHorizontal size={12} />
                </MessageActionButton>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // Full-page text-only view when a saved chat is opened (before starting the voice session)
  if (isContinue && !started) {
    return (
      <div className="h-full w-full bg-transparent flex flex-col overflow-hidden select-none animate-fade-in">
        {/* Nav bar with share button in the top-right corner */}
        <div className="shrink-0 h-14 border-b border-white/8 flex items-center justify-between px-4 sm:px-6">
          <span className="text-[13px] font-semibold text-white tracking-tight">Conversation</span>
          <div className="flex items-center gap-2">
            {chatId && (
              <button
                onClick={handleShareActive}
                className="h-8 px-3 rounded-lg flex items-center gap-2 text-ink-300 hover:text-white hover:bg-white/5 border border-white/10 transition"
                title="Share this chat"
                aria-label="Share this chat"
              >
                <Share2 size={14} /> Share
              </button>
            )}
          </div>
        </div>

        {/* Full-page scrollable transcript (invisible scrollbar) */}
        <div ref={transcriptRef} className="flex-1 w-full max-w-2xl mx-auto overflow-y-auto scrollbar-hide px-4 sm:px-6 py-6">
          {history.length === 0 ? (
            <div className="h-full flex items-center justify-center text-ink-400 text-[13px]">No messages yet.</div>
          ) : (
            renderMessages()
          )}
        </div>

        {/* Continue with this chat */}
        <div className="shrink-0 pb-6 pt-2 flex items-center justify-center">
          <button
            onClick={startSessionFlow}
            className="px-8 h-12 rounded-full border border-white/10 bg-ink-800 text-white hover:bg-ink-700 active:scale-95 transition-all shadow-glow font-semibold tracking-wide text-[13px]"
          >
            Continue with this chat
          </button>
        </div>

        {/* More options dropdown (opens ABOVE the button) */}
        {moreMenuIndex !== null && moreMenuPos && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => { setMoreMenuIndex(null); setMoreMenuPos(null); }} />
            <div
              className="fixed z-50 w-40 rounded-xl bg-ink-900 border border-white/10 p-1 shadow-2xl animate-in fade-in duration-100"
              style={{ left: moreMenuPos.left, bottom: moreMenuPos.bottom }}
            >
              {(() => {
                const target = history[moreMenuIndex];
                if (!target) return null;
                return (
                  <div className="space-y-0.5">
                    {readAloudEnabled && (
                      <button
                        onClick={() => { setMoreMenuIndex(null); setMoreMenuPos(null); handleReadAloud(target.content); }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-ink-100 hover:bg-white/5 hover:text-white transition text-left"
                      >
                        <Volume2 size={13} className="text-ink-300" /> Read aloud
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteMessage(moreMenuIndex)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-red-400 hover:bg-red-500/10 hover:text-red-300 transition text-left"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                );
              })()}
            </div>
          </>
        )}

        {shareChat && (
          <ShareModal open={!!shareChat} onClose={() => setShareChat(null)} chat={shareChat} />
        )}
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-transparent flex flex-col items-center overflow-hidden py-6 px-4 sm:px-6 select-none animate-fade-in">

      {/* Top bar with share button */}
      <div className="w-full max-w-2xl mx-auto flex items-center justify-end h-8 shrink-0">
        {chatId && (
          <button
            onClick={handleShareActive}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-300 hover:text-white hover:bg-white/5 transition"
            title="Share this chat"
            aria-label="Share this chat"
          >
            <Share2 size={16} />
          </button>
        )}
      </div>

      {/* Main Voice Assistant Viewport */}
      <div className="flex-1 w-full flex flex-col items-center justify-center min-h-0 relative">
        <div className="relative w-80 h-80 flex items-center justify-center">
          <canvas ref={canvasRef} className="w-full h-full max-w-[450px] max-h-[450px] object-contain" />
        </div>

        {/* Real-time Subtitles / Status Guide (Shown below the circle when started) */}
        {started && (
          <div className="mt-8 text-center animate-fade-in max-w-lg px-4">
            {!isSpeechSupported ? (
              <p className="text-[13px] font-semibold text-red-400 uppercase">
                Web Speech API not supported in this browser
              </p>
            ) : (
              <>
                {state === 'speaking' ? (
                  <p className="text-sm font-medium leading-relaxed text-ink-100 transition-all duration-300">
                    {aiResponseText}
                  </p>
                ) : state === 'thinking' ? (
                  <p className="text-xs font-semibold tracking-wider text-ink-400 uppercase animate-pulse-soft">
                    Thinking…
                  </p>
                ) : (
                  // Show the recognized user speech in small text while listening
                  liveUserText ? (
                    <p className="text-xs text-ink-300 leading-relaxed max-w-sm mx-auto">
                      <span className="text-ink-500 font-medium">You:</span> {liveUserText}
                    </p>
                  ) : (
                    <div className="h-5" />
                  )
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Center/Bottom Action Controls */}
      <div className="z-20 py-2 h-14 flex items-center justify-center">
        {!started ? (
          <button
            onClick={startSessionFlow}
            className="px-8 h-12 rounded-full border border-white/10 bg-ink-800 text-white hover:bg-ink-700 active:scale-95 transition-all shadow-glow font-semibold tracking-wide text-[13px]"
          >
            {history.length > 0 ? 'Continue Voice Chat' : 'Start Voice Chat'}
          </button>
        ) : (
          <div className="flex items-center gap-6 animate-scale-in">
            {/* End Call / Close button */}
            <button
              onClick={endSession}
              className="w-12 h-12 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 text-white flex items-center justify-center transition-all shadow-soft"
              aria-label="End voice session"
              title="End session"
            >
              <X size={20} />
            </button>

            {/* Mute button */}
            <button
              onClick={() => setMuted((m) => !m)}
              className={cn(
                "w-12 h-12 rounded-full border flex items-center justify-center transition-all shadow-soft active:scale-95",
                muted
                  ? "bg-ink-700 text-white border-white/20 hover:bg-ink-600"
                  : "bg-white/5 border-white/10 hover:bg-white/10 text-white"
              )}
              aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          </div>
        )}
      </div>

      {/* More options dropdown (opens ABOVE the button) */}
      {moreMenuIndex !== null && moreMenuPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setMoreMenuIndex(null); setMoreMenuPos(null); }} />
          <div
            className="fixed z-50 w-40 rounded-xl bg-ink-900 border border-white/10 p-1 shadow-2xl animate-in fade-in duration-100"
            style={{ left: moreMenuPos.left, bottom: moreMenuPos.bottom }}
          >
            {(() => {
              const target = history[moreMenuIndex];
              if (!target) return null;
              return (
                <div className="space-y-0.5">
                  {readAloudEnabled && (
                    <button
                      onClick={() => { setMoreMenuIndex(null); setMoreMenuPos(null); handleReadAloud(target.content); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-ink-100 hover:bg-white/5 hover:text-white transition text-left"
                    >
                      <Volume2 size={13} className="text-ink-300" /> Read aloud
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteMessage(moreMenuIndex)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-red-400 hover:bg-red-500/10 hover:text-red-300 transition text-left"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              );
            })()}
          </div>
        </>
      )}

      {shareChat && (
        <ShareModal open={!!shareChat} onClose={() => setShareChat(null)} chat={shareChat} />
      )}
    </div>
  );
}
