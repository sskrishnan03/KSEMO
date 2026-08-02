import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Mic, MicOff, X, Share2, Copy, MoreHorizontal, Trash2, Volume2, Check, Download, FileDown, FileType, FileText, AudioWaveform } from 'lucide-react';
import { cn, estimateTokens } from '../lib/utils';
import { useTheme } from '../components/ThemeProvider';
import { useAuthContext } from '../components/AuthProvider';
import { createVoiceChat, insertMessage, updateChat, deleteMessage, getSettings, upsertSettings, logUsage, listChats, listMessages, setLastActiveChatId } from '../lib/data';
import { streamChat, VOICE_SYSTEM_PROMPT, type ChatMessage } from '../lib/ai';
import { getStoredVoiceId, setStoredVoiceId, VOICE_STORAGE_KEY } from '../lib/voices';
import { Markdown } from '../components/Markdown';
import { ShareModal } from '../components/ShareModal';
import { exportChatAsPDF, exportChatAsDocx, exportChatAsText } from '../lib/exportChat';
import { getVoiceEngine } from '../lib/voice/VoiceEngine';
import { adjustResponseForEmotion } from '../lib/voice/StreamingResponseHandler';
import type { VoiceEvent, TranscriptEvent, EmotionData, Emotion, TTSConfig, VoicePreferences, InputMode } from '../lib/voice/types';
import type { Chat, AppPreferences } from '../lib/types';

type HistoryEntry = { id?: string; role: 'user' | 'assistant'; content: string };

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted' | 'error' | 'reconnecting';

const RECONNECT_DELAY_MS = 1500;
const MAX_RECONNECT_ATTEMPTS = 5;

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

// Emotion-aware speaking style: nudge rate/pitch relative to the user's prefs.
function emotionToneAdjustment(emotion?: Emotion | null): { rate?: number; pitch?: number } {
  switch (emotion) {
    case 'happy': return { rate: 1.1, pitch: 1.05 };
    case 'excited': return { rate: 1.15, pitch: 1.08 };
    case 'sad': return { rate: 0.9, pitch: 0.95 };
    case 'angry': return { rate: 0.9, pitch: 0.9 };
    case 'calm': return { rate: 0.95, pitch: 1.0 };
    case 'nervous': return { rate: 0.95, pitch: 1.02 };
    case 'confused': return { rate: 0.95, pitch: 1.0 };
    case 'professional': return { rate: 0.97, pitch: 0.98 };
    case 'friendly': return { rate: 1.05, pitch: 1.03 };
    default: return {};
  }
}

export default function VoiceChat() {
  const nav = useNavigate();
  const loc = useLocation();
  const { chatId: routeChatId } = useParams<{ chatId?: string }>();
  const { resolvedTheme } = useTheme();
  const { profile } = useAuthContext();

  const engine = useRef(getVoiceEngine()).current;
  const isSpeechSupported = engine.isSupported();

  const [state, setState] = useState<VoiceState>('idle');
  const [muted, setMuted] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [chatId, setChatId] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [aiResponseText, setAiResponseText] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>(engine.getPreferences().inputMode);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [shareChat, setShareChat] = useState<Chat | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [moreMenuIndex, setMoreMenuIndex] = useState<number | null>(null);
  const [moreMenuPos, setMoreMenuPos] = useState<{ left: number; bottom: number } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [readAloudEnabled, setReadAloudEnabled] = useState(true);
  const [readingIndex, setReadingIndex] = useState<number | null>(null);
  const [loadingChat, setLoadingChat] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const conversationRef = useRef<ChatMessage[]>([]);
  const stateRef = useRef<VoiceState>('idle');
  const mutedRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const exchangesRef = useRef(0);
  const totalTokensRef = useRef(0);
  const chatIdRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const processingRef = useRef(false);
  const turnRef = useRef(0);
  const emotionRef = useRef<EmotionData | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const readingIndexRef = useRef<number | null>(null);

  // Cloud-sync refs: mirror VoiceMemory into Supabase so voice preferences
  // follow the user across devices, and the Settings page stays consistent.
  const settingsRef = useRef<AppPreferences>({});
  const applyingCloudRef = useRef(false);
  const cloudWriteTimerRef = useRef<number | null>(null);
  const pendingCloudPrefsRef = useRef<VoicePreferences | null>(null);

  // Sync state and muted to refs for the callbacks
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { chatIdRef.current = chatId; }, [chatId]);
  useEffect(() => { startedRef.current = started; }, [started]);

  const voiceLevelRef = useRef(0);
  useEffect(() => { voiceLevelRef.current = voiceLevel; }, [voiceLevel]);

  // Connect read-aloud + voice selection to the user's Settings preference.
  // Supabase is the source of truth for voice settings; mirror them into
  // VoiceMemory (applyingCloudRef blocks the echo write-back below).
  useEffect(() => {
    if (!profile?.id) return;
    getSettings(profile.id).then((s) => {
      const cloud = s?.preferences ?? {};
      settingsRef.current = cloud;
      applyingCloudRef.current = true;
      const vp = cloud.voice_preferences;
      if (vp && Object.keys(vp).length) {
        engine.updatePreferences({ ...vp });
      }
      const v = cloud.voice_id;
      if (v) {
        engine.updatePreferences({ voiceId: v });
        setStoredVoiceId(v);
      }
      setReadAloudEnabled(cloud.read_aloud_enabled ?? true);
      applyingCloudRef.current = false;
    }).catch(() => {});
  }, [profile?.id]);

  // Debounced write-back of voice prefs → Supabase (cloud sync + keeps the
  // Settings page's voice selector in sync). Fires on every change, coalesced.
  const scheduleCloudPrefsWrite = useCallback((prefs: VoicePreferences) => {
    if (applyingCloudRef.current) return;
    if (!profile?.id) return;
    pendingCloudPrefsRef.current = prefs;
    if (cloudWriteTimerRef.current !== null) window.clearTimeout(cloudWriteTimerRef.current);
    cloudWriteTimerRef.current = window.setTimeout(() => {
      cloudWriteTimerRef.current = null;
      const p = pendingCloudPrefsRef.current;
      if (!p || !profile?.id) return;
      pendingCloudPrefsRef.current = null;
      upsertSettings(profile.id, {
        ...settingsRef.current,
        voice_id: p.voiceId,
        voice_preferences: { ...p },
      }).catch(() => {});
    }, 500);
  }, [profile?.id]);

  // React live if the voice changes in another tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === VOICE_STORAGE_KEY) engine.updatePreferences({ voiceId: getStoredVoiceId() });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [engine]);

  // Interrupt the assistant mid-speech (barge-in): cancel TTS + abort the AI
  // request, invalidate the in-flight turn, and let the next utterance start.
  const triggerBargeIn = useCallback(() => {
    turnRef.current += 1;
    processingRef.current = false;
    engine.stopBargeInMonitoring();
    engine.interrupt();
  }, [engine]);

  // Process user speech → AI (streaming, sentence-by-sentence TTS) → listen again
  const processUserSpeech = useCallback(async (text: string) => {
    if (processingRef.current) return;
    if (!text.trim()) return;
    processingRef.current = true;
    const turn = ++turnRef.current;

    // Stop recognizing so the mic doesn't hear the assistant's own voice, but
    // keep VAD running so the user can still interrupt (barge-in).
    engine.stopListening();
    engine.startBargeInMonitoring();

    // Create the chat lazily on the first spoken message so an empty session
    // never leaves an empty chat behind.
    if (!chatIdRef.current) {
      const c = await createVoiceChat();
      if (!c) {
        if (turn === turnRef.current) {
          processingRef.current = false;
          stateRef.current = 'listening';
          setState('listening');
        }
        return;
      }
      chatIdRef.current = c.id;
      setChatId(c.id);
      setLastActiveChatId(c.id);
      const autoTitle = text.slice(0, 48) + (text.length > 48 ? '…' : '');
      await updateChat(c.id, { title: autoTitle });
      window.dispatchEvent(new CustomEvent('ksemo-chats-updated'));
    }
    if (turn !== turnRef.current) return;

    conversationRef.current.push({ role: 'user', content: text });
    const userMsg = await insertMessage({ chat_id: chatIdRef.current, role: 'user', content: text });
    setHistory((h) => [...h, { id: userMsg?.id ?? undefined, role: 'user', content: text }]);

    const controller = new AbortController();
    abortRef.current = controller;
    engine.setAbortController(controller);

    setStreamingText('');
    setAiResponseText('');
    stateRef.current = 'thinking';
    setState('thinking');

    const detectedEmotion = emotionRef.current?.emotion ?? null;
    const systemPrompt = adjustResponseForEmotion(VOICE_SYSTEM_PROMPT, detectedEmotion ?? 'neutral');
    const prefs = engine.getPreferences();
    const tone = emotionToneAdjustment(detectedEmotion);
    const ttsOverrides: Partial<TTSConfig> = {
      rate: Math.min(2, Math.max(0.5, prefs.rate * (tone.rate ?? 1))),
      pitch: Math.min(2, Math.max(0.5, prefs.pitch * (tone.pitch ?? 1))),
    };

    // Sentence-level streaming: speak each completed sentence as soon as it
    // arrives so the voice starts before the full answer is done.
    const sentences: string[] = [];
    let buffer = '';
    let pumpActive = false;
    let drainResolve: (() => void) | null = null;
    let drainPromise: Promise<void> | null = null;

    const runPump = async () => {
      while (sentences.length) {
        if (turn !== turnRef.current) break;
        if (mutedRef.current) break;
        const sentence = sentences.shift()!;
        stateRef.current = 'speaking';
        setState('speaking');
        const ok = await engine.speak(stripMarkdown(sentence), ttsOverrides, (revealed) => setAiResponseText(revealed));
        if (!ok) break;
        if (turn !== turnRef.current) break;
      }
      pumpActive = false;
      if (drainResolve) {
        const r = drainResolve;
        drainResolve = null;
        drainPromise = null;
        r();
      }
    };

    const enqueueSentence = (sentence: string) => {
      sentences.push(sentence);
      if (!drainPromise) {
        drainPromise = new Promise<void>((res) => { drainResolve = res; });
      }
      if (!pumpActive) { pumpActive = true; runPump(); }
    };

    const flushSentences = () => {
      const parts = buffer.split(/(?<=[.!?])\s+|\r?\n+/);
      if (parts.length > 1) {
        for (let i = 0; i < parts.length - 1; i++) {
          const s = parts[i].trim();
          if (s) enqueueSentence(s);
        }
        buffer = parts[parts.length - 1];
      }
    };

    const resumeListening = async (turn: number) => {
      if (mutedRef.current || !startedRef.current || turn !== turnRef.current) return;
      // Brief pause so the mic doesn't snap back on the instant speech ends.
      await new Promise((r) => setTimeout(r, 500));
      if (mutedRef.current || !startedRef.current || turn !== turnRef.current) return;
      if (stateRef.current === 'interrupted') return; // barge-in already restarted listening
      const mode = engine.getPreferences().inputMode;
      if (mode === 'wake_word') {
        engine.stopListening();
        engine.startWakeWordStandby();
        stateRef.current = 'idle';
        setState('idle');
      } else if (mode === 'push_to_talk') {
        engine.stopListening();
        stateRef.current = 'idle';
        setState('idle');
      } else {
        engine.startListening();
        stateRef.current = 'listening';
        setState('listening');
      }
    };

    try {
      const result = await streamChat({
        model: 'ksemo-pro',
        messages: [{ role: 'system', content: systemPrompt }, ...conversationRef.current.slice(-12)],
        signal: controller.signal,
        onToken: (token) => {
          if (turn !== turnRef.current) return;
          buffer += token;
          setStreamingText((prev) => prev + token);
          flushSentences();
        },
      });

      if (turn !== turnRef.current) return;

      conversationRef.current.push({ role: 'assistant', content: result.content });
      exchangesRef.current += 1;
      totalTokensRef.current += result.tokens;

      const aiMsg = await insertMessage({ chat_id: chatIdRef.current, role: 'assistant', content: result.content, model: 'ksemo-pro', tokens: result.tokens });
      await logUsage('ksemo-pro', estimateTokens(text), result.tokens, result.latencyMs);
      setHistory((h) => [...h, { id: aiMsg?.id ?? undefined, role: 'assistant', content: result.content }]);

      if (buffer.trim()) { enqueueSentence(buffer.trim()); buffer = ''; }
      await (drainPromise ?? Promise.resolve());

      if (turn !== turnRef.current) return;
      setStreamingText('');
      setAiResponseText('');
      await resumeListening(turn);
    } catch (err) {
      if (turn !== turnRef.current) return;
      if ((err as Error).name === 'AbortError') {
        // Barge-in / mute already handled restarting listening.
        stateRef.current = 'listening';
        setState('listening');
        return;
      }
      console.error('Voice chat error:', err);
      const errMsg = (err as Error)?.message ?? '';
      stateRef.current = 'error';
      setState('error');

      // Invalid/expired API key: tell the user and keep listening.
      if (/invalid api key|unauthorized|user not found|api key is invalid/i.test(errMsg)) {
        await engine.speak("I couldn't reach the AI service because the Gemini API key is invalid or expired. Please update it in the environment file and refresh the app.");
        await resumeListening(turn);
        return;
      }

      // Quota / rate limit: let the user know and keep the session running.
      if (/quota|rate limit|too many requests/i.test(errMsg)) {
        await engine.speak("The AI service is currently busy or out of quota. Please wait a moment and ask again.");
        await resumeListening(turn);
        return;
      }

      await new Promise((r) => setTimeout(r, RECONNECT_DELAY_MS));
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS && turn === turnRef.current) {
        reconnectAttemptsRef.current += 1;
        stateRef.current = 'reconnecting';
        setState('reconnecting');
        await new Promise((r) => setTimeout(r, 500));
        await resumeListening(turn);
      } else {
        stateRef.current = 'listening';
        setState('listening');
        await resumeListening(turn);
      }
    } finally {
      if (turn === turnRef.current) processingRef.current = false;
      if (turn === turnRef.current) engine.stopBargeInMonitoring();
    }
  }, [engine]);

  // Engine event wiring (singleton listeners are removed on unmount).
  useEffect(() => {
    const onFinal = (ev: VoiceEvent) => {
      const t = ((ev.data as TranscriptEvent)?.text ?? '').trim();
      if (!t || processingRef.current || !startedRef.current || mutedRef.current) return;
      reconnectAttemptsRef.current = 0;
      processUserSpeech(t);
    };

    const onSpeechStarted = () => {
      // Barge-in: the user started talking while the assistant was speaking/thinking.
      if (!startedRef.current || mutedRef.current) return;
      if (stateRef.current === 'speaking' || stateRef.current === 'thinking') {
        triggerBargeIn();
      }
    };

    const onEmotion = (ev: VoiceEvent) => {
      emotionRef.current = ev.data as EmotionData;
    };

    const onWakeWord = () => {
      // Wake word heard → start listening for the actual command.
      if (!startedRef.current || mutedRef.current) return;
      engine.stopWakeWordStandby();
      engine.startListening();
      stateRef.current = 'listening';
      setState('listening');
    };

    const onPTTActivated = () => {
      // Manual barge-in: user pressed to talk while the assistant was speaking.
      if (!startedRef.current || mutedRef.current) return;
      if (stateRef.current === 'speaking' || stateRef.current === 'thinking') {
        triggerBargeIn();
      }
    };

    const onEngineError = (ev: VoiceEvent) => {
      const err = ev.data as { error?: string } | string;
      const code = typeof err === 'object' && err ? (err.error ?? '') : (err ?? '');
      if (code === 'not-allowed' || code === 'microphone_denied') {
        stateRef.current = 'error';
        setState('error');
      }
    };

    const onPrefsChanged = (ev: VoiceEvent) => {
      const p = ev.data as VoicePreferences;
      setInputMode(p.inputMode === 'wake_word' && !p.wakeWordEnabled ? 'hands_free' : p.inputMode);
      scheduleCloudPrefsWrite(p);
    };

    engine.on('transcript_final', onFinal);
    engine.on('speech_started', onSpeechStarted);
    engine.on('emotion_detected', onEmotion);
    engine.on('wake_word_detected', onWakeWord);
    engine.on('push_to_talk_activated', onPTTActivated);
    engine.on('error', onEngineError);
    engine.on('preferences_changed', onPrefsChanged);

    return () => {
      engine.off('transcript_final', onFinal);
      engine.off('speech_started', onSpeechStarted);
      engine.off('emotion_detected', onEmotion);
      engine.off('wake_word_detected', onWakeWord);
      engine.off('push_to_talk_activated', onPTTActivated);
      engine.off('error', onEngineError);
      engine.off('preferences_changed', onPrefsChanged);
    };
  }, [engine, processUserSpeech, triggerBargeIn, scheduleCloudPrefsWrite]);

  // Stop everything the engine is doing.
  const stopAll = useCallback(() => {
    engine.stopSession().catch(() => {});
    engine.stopBargeInMonitoring();
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    try { window.speechSynthesis?.cancel(); } catch { /* ok */ }
  }, [engine]);

  // Click gesture handler to boot up WebAudio and speech engine.
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

    // Unlock WebAudio within the click gesture so the engine's AudioContext
    // gets created already running (Chrome requires a user gesture).
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (ctx.state === 'suspended') await ctx.resume();
      ctx.close().catch(() => {});
    } catch (err) {
      console.error('AudioContext gesture initialize error:', err);
    }

    // Reveal the session UI right away so it never feels like it's "loading".
    startedRef.current = true;
    setStarted(true);
    stateRef.current = 'idle';
    setState('idle');

    if (!chatIdRef.current) {
      // Fresh session: the chat is created lazily on the first spoken message,
      // so an empty session never leaves an empty chat behind.
      conversationRef.current = [];
      setHistory([]);
    }
    exchangesRef.current = 0;
    totalTokensRef.current = 0;
    reconnectAttemptsRef.current = 0;

    try {
      await engine.startSession();
      const mode = engine.getPreferences().inputMode;
      if (mode === 'wake_word' || mode === 'push_to_talk') {
        stateRef.current = 'idle';
        setState('idle');
      } else {
        stateRef.current = 'listening';
        setState('listening');
      }
    } catch (err) {
      console.error('Failed to start voice engine:', err);
      stateRef.current = 'error';
      setState('error');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAll();
      if (cloudWriteTimerRef.current !== null) window.clearTimeout(cloudWriteTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stay silent when the user leaves this tab/window: cancel any speech in
  // progress so nothing keeps talking in the background.
  useEffect(() => {
    const onLeave = () => {
      if (document.hidden || !document.hasFocus()) {
        try { window.speechSynthesis.cancel(); } catch { /* ok */ }
      }
    };
    document.addEventListener('visibilitychange', onLeave);
    window.addEventListener('blur', onLeave);
    return () => {
      document.removeEventListener('visibilitychange', onLeave);
      window.removeEventListener('blur', onLeave);
    };
  }, []);

  // On route change: reset, and if a specific chat is opened, load its conversation
  // so the AI has context. The screen looks and behaves exactly like a normal voice chat.
  useEffect(() => {
    let cancelled = false;
    const setup = async () => {
      await stopAll();
      startedRef.current = false;
      setStarted(false);
      stateRef.current = 'idle';
      setState('idle');
      setStreamingText('');
      setAiResponseText('');
      conversationRef.current = [];
      setHistory([]);
      setChatId(routeChatId ?? null);
      chatIdRef.current = routeChatId ?? null;
      if (routeChatId) {
        setLoadingChat(true);
        setLastActiveChatId(routeChatId);
        const msgs = await listMessages(routeChatId);
        if (cancelled) return;
        const loaded: HistoryEntry[] = msgs
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content }));
        conversationRef.current = loaded;
        setHistory(loaded);
        setLoadingChat(false);
      }
    };
    setup();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeChatId, stopAll]);

  // Keep the saved-chat transcript scrolled to the newest message
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history]);

  // End session → save the conversation title, reset, and return to the normal voice chat screen.
  const endSession = useCallback(async () => {
    await stopAll();
    startedRef.current = false;
    stateRef.current = 'idle';
    setStarted(false);

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
      // transcript stays up to date and can be continued with one click.
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

    const endedChatId = chatIdRef.current;
    chatIdRef.current = null;
    setChatId(null);
    conversationRef.current = [];
    setHistory([]);
    exchangesRef.current = 0;
    totalTokensRef.current = 0;
    reconnectAttemptsRef.current = 0;

    if (endedChatId) {
      // Open the ended chat so its transcript stays on screen and can be
      // continued with one click — never fall back to the start screen.
      nav(`/app/voice-chat/${endedChatId}`);
    } else if (loc.pathname.startsWith('/app/voice-chat/')) {
      nav('/app/voice-chat', { replace: true });
    }
  }, [nav, stopAll, loc.pathname, routeChatId]);

  // Mute / Unmute handler. Only reacts to `muted` changes — session startup is
  // handled by startSessionFlow, and an in-flight AI turn is left to finish so
  // its transcript is still saved (only audio + listening are suspended).
  useEffect(() => {
    if (!startedRef.current) return;
    if (muted) {
      engine.stopListening();
      engine.stopWakeWordStandby();
      engine.stopBargeInMonitoring();
      try { window.speechSynthesis.cancel(); } catch { /* ok */ }
    } else {
      const mode = engine.getPreferences().inputMode;
      if (mode === 'wake_word') {
        engine.startWakeWordStandby();
        stateRef.current = 'idle';
        setState('idle');
      } else if (mode === 'push_to_talk') {
        stateRef.current = 'idle';
        setState('idle');
      } else if (stateRef.current !== 'speaking' && stateRef.current !== 'thinking') {
        engine.startListening();
        stateRef.current = 'listening';
        setState('listening');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted]);

  // Push-to-talk handlers
  const handlePTTDown = useCallback(() => {
    if (!startedRef.current || mutedRef.current) return;
    engine.activatePushToTalk();
    stateRef.current = 'listening';
    setState('listening');
  }, [engine]);

  const handlePTTUp = useCallback(() => {
    engine.deactivatePushToTalk();
  }, [engine]);

  // Hold Space to talk (push-to-talk mode)
  useEffect(() => {
    if (inputMode !== 'push_to_talk' || !started) return;
    const isTyping = () => {
      const el = document.activeElement;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || isTyping()) return;
      e.preventDefault();
      if (mutedRef.current) return;
      engine.activatePushToTalk();
      stateRef.current = 'listening';
      setState('listening');
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      engine.deactivatePushToTalk();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [inputMode, started, engine]);

  // Real-time amplitude loop (drives the wobbly circle with the live mic level)
  useEffect(() => {
    let animFrame: number;
    let time = 0;

    const loop = () => {
      time += 1;
      let level = 0;

      if (started) {
        if (stateRef.current === 'listening') {
          level = engine.getAudioLevel();
        } else if (stateRef.current === 'speaking') {
          const sim = 0.05 + Math.abs(Math.sin(time * 0.14) * Math.cos(time * 0.06)) * 0.38;
          const isPause = Math.sin(time * 0.035) < -0.65;
          level = isPause ? 0.01 : sim;
        } else if (stateRef.current === 'thinking') {
          level = 0.01 + Math.abs(Math.sin(time * 0.08)) * 0.03;
        } else if (stateRef.current === 'idle') {
          level = 0.01 + Math.abs(Math.sin(time * 0.03)) * 0.02;
        }
      }

      setVoiceLevel(level);
      animFrame = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(animFrame);
  }, [started, engine]);

  // Canvas Fluid Circle Renderer (fresh voice chat only)
  useEffect(() => {
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
  }, [resolvedTheme, started]);

  // Share the currently active chat
  const handleShareActive = async () => {
    if (!chatId) return;
    try {
      const all = await listChats();
      const c = all.find((x) => x.id === chatId);
      if (c) setShareChat(c);
    } catch { /* ignore */ }
  };

  // Export the current chat as PDF / Word / text — user messages right, AI left.
  const handleExport = async (format: 'pdf' | 'docx' | 'txt') => {
    setExportOpen(false);
    if (!history.length) return;
    const firstUser = history.find((h) => h.role === 'user');
    const title = firstUser
      ? firstUser.content.slice(0, 48) + (firstUser.content.length > 48 ? '…' : '')
      : 'Voice Chat';
    const messages = history.map((h) => ({ role: h.role, content: h.content }));
    try {
      if (format === 'pdf') await exportChatAsPDF(title, messages);
      else if (format === 'docx') await exportChatAsDocx(title, messages);
      else exportChatAsText(title, messages);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  // Copy a message to the clipboard
  const handleCopyMessage = async (index: number, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex((i) => (i === index ? null : i)), 1500);
    } catch { /* ignore */ }
  };

  // Read a single AI message aloud; clicking again stops it.
  const handleReadAloud = async (index: number, content: string) => {
    if (readingIndexRef.current === index) {
      window.speechSynthesis?.cancel();
      readingIndexRef.current = null;
      setReadingIndex(null);
      return;
    }
    window.speechSynthesis?.cancel();
    readingIndexRef.current = index;
    setReadingIndex(index);
    await engine.speak(stripMarkdown(content));
    if (readingIndexRef.current === index) {
      readingIndexRef.current = null;
      setReadingIndex(null);
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
        return (
          <div key={i} className={cn(isUser && 'group')}>
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

            {/* Message action row — copy + share on every message, more options on AI replies.
                User messages reveal the buttons only on hover; AI replies keep them visible. */}
            <div className={cn('flex items-center gap-1 mt-1.5', isUser ? 'justify-end opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity' : 'justify-start')}>
              <MessageActionButton title="Copy" onClick={() => handleCopyMessage(i, h.content)}>
                {isCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </MessageActionButton>

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

  return (
    <div className="h-full w-full bg-transparent flex flex-col items-center overflow-hidden py-6 px-4 sm:px-6 select-none animate-fade-in">

      {/* Top bar with export + share buttons (top-right corner, navbar style) */}
      <div className="w-full flex items-center justify-end h-8 shrink-0 px-4 sm:px-6 relative">
        {chatId && history.length > 0 && (
          <>
            <div className="relative ml-1">
              <button
                onClick={() => setExportOpen((o) => !o)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-300 hover:text-white hover:bg-white/5 transition"
                title="Export chat"
                aria-label="Export chat"
              >
                <Download size={16} />
              </button>

              {exportOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-white/10 bg-ink-800 shadow-lift z-50 py-1 animate-scale-in">
                    <div className="px-3 pt-1.5 pb-1 text-[10px] uppercase tracking-wider text-ink-400">Export as</div>
                    <button
                      onClick={() => handleExport('pdf')}
                      className="w-full flex items-center gap-2.5 px-3 h-9 text-[12px] text-ink-100 hover:bg-white/5 hover:text-white transition"
                    >
                      <FileDown size={13} className="text-ink-300 shrink-0" /> PDF document
                    </button>
                    <button
                      onClick={() => handleExport('docx')}
                      className="w-full flex items-center gap-2.5 px-3 h-9 text-[12px] text-ink-100 hover:bg-white/5 hover:text-white transition"
                    >
                      <FileType size={13} className="text-ink-300 shrink-0" /> Word document
                    </button>
                    <button
                      onClick={() => handleExport('txt')}
                      className="w-full flex items-center gap-2.5 px-3 h-9 text-[12px] text-ink-100 hover:bg-white/5 hover:text-white transition"
                    >
                      <FileText size={13} className="text-ink-300 shrink-0" /> Plain text
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={handleShareActive}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-300 hover:text-white hover:bg-white/5 transition ml-1"
              title="Share this chat"
              aria-label="Share this chat"
            >
              <Share2 size={16} />
            </button>
          </>
        )}
      </div>

      {!started && loadingChat ? (
        <div className="flex-1 w-full flex items-center justify-center">
          <div className="h-6 w-6 rounded-full border-2 border-ink-300/30 border-t-ink-300 animate-spin" />
        </div>
      ) : !started && history.length > 0 ? (
        <>
          <div ref={transcriptRef} className="flex-1 w-full max-w-2xl mx-auto overflow-y-auto scrollbar-hide px-4 sm:px-6 py-4">
            {renderMessages()}
          </div>

          <div className="z-20 py-2 h-14 flex items-center justify-center shrink-0">
            <button
              onClick={startSessionFlow}
              className="px-8 h-12 rounded-full border border-white/10 bg-ink-800 text-white hover:bg-ink-700 active:scale-95 transition-all shadow-glow font-semibold tracking-wide text-[13px] flex items-center gap-2"
            >
              <AudioWaveform size={16} className="shrink-0" />
              Continue Voice Chat
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Main Voice Assistant Viewport */}
          <div className="flex-1 w-full flex flex-col items-center justify-center min-h-0 relative">
            <div className="relative w-80 h-80 flex items-center justify-center">
              <canvas ref={canvasRef} className="w-full h-full max-w-[450px] max-h-[450px] object-contain" />
            </div>

            {/* AI's reply, live word-by-word. Your speech is never shown. */}
            {started && (
              <div className="mt-8 text-center animate-fade-in max-w-lg px-4 min-h-[52px]">
                {!isSpeechSupported ? (
                  <p className="text-[13px] font-semibold text-red-400 uppercase">
                    Web Speech API not supported in this browser
                  </p>
                ) : state === 'speaking' ? (
                  <p className="text-sm font-medium leading-relaxed text-ink-100 transition-all duration-300 min-h-[1.5em]">
                    {aiResponseText}
                  </p>
                ) : state === 'thinking' ? (
                  streamingText ? (
                    <p className="text-sm font-medium leading-relaxed text-ink-100 transition-all duration-300 min-h-[1.5em]">
                      {streamingText}
                    </p>
                  ) : (
                    <p className="text-xs font-semibold tracking-wider text-ink-400 uppercase animate-pulse-soft">
                      Thinking…
                    </p>
                  )
                ) : state === 'error' ? (
                  <p className="text-[13px] font-semibold text-red-400 uppercase">
                    Microphone not available
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {/* Center/Bottom Action Controls */}
          <div className="z-20 py-2 h-14 flex items-center justify-center">
            {!started ? (
              <button
                onClick={startSessionFlow}
                className="px-8 h-12 rounded-full border border-white/10 bg-ink-800 text-white hover:bg-ink-700 active:scale-95 transition-all shadow-glow font-semibold tracking-wide text-[13px] flex items-center gap-2"
              >
                <Mic size={16} className="shrink-0" />
                Start Voice Chat
              </button>
            ) : (
              <div className="flex items-center gap-6 animate-scale-in">
                {/* Push to talk */}
                {inputMode === 'push_to_talk' && (
                  <button
                    onPointerDown={handlePTTDown}
                    onPointerUp={handlePTTUp}
                    onPointerLeave={handlePTTUp}
                    onPointerCancel={handlePTTUp}
                    className="w-12 h-12 rounded-full border flex items-center justify-center transition-all shadow-soft active:scale-95 select-none touch-none bg-emerald-500/20 border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/30"
                    aria-label="Hold to talk"
                    title="Hold to talk (or hold Space)"
                  >
                    <Mic size={20} />
                  </button>
                )}

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
        </>
      )}

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
                      onClick={() => { setMoreMenuIndex(null); setMoreMenuPos(null); handleReadAloud(moreMenuIndex, target.content); }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-ink-100 hover:bg-white/5 hover:text-white transition text-left"
                    >
                      <Volume2 size={13} className="text-ink-300" />
                      {readingIndex === moreMenuIndex ? 'Stop reading' : 'Read aloud'}
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
