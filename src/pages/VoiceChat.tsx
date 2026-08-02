import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Mic, MicOff, X, Share2, Copy, MoreHorizontal, Trash2, Volume2, Check, Download, FileDown, FileType, FileText, AudioWaveform } from 'lucide-react';
import { cn, estimateTokens } from '../lib/utils';
import { useTheme } from '../components/ThemeProvider';
import { useAuthContext } from '../components/AuthProvider';
import { createVoiceChat, insertMessage, updateChat, deleteMessage, getSettings, logUsage, listChats, listMessages, setLastActiveChatId } from '../lib/data';
import { streamChat, VOICE_SYSTEM_PROMPT, type ChatMessage } from '../lib/ai';
import { VOICE_STORAGE_KEY, getStoredVoiceId, setStoredVoiceId, loadVoices, pickVoice } from '../lib/voices';
import { Markdown } from '../components/Markdown';
import { ShareModal } from '../components/ShareModal';
import { exportChatAsPDF, exportChatAsDocx, exportChatAsText } from '../lib/exportChat';
import { getPluginRegistry } from '../lib/plugins';
import { parsePluginCommand } from '../lib/voice/PluginIntentParser';
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

// Fast, offline parameter extraction used when the LLM parser is unavailable.
function extractPluginParamsLegacy(text: string, action: any): Record<string, any> {
  const params: Record<string, any> = {};
  const lowerText = text.toLowerCase();

  for (const param of action.parameters) {
    if (param.name === 'to' && lowerText.includes('to ')) {
      const match = lowerText.match(/to\s+([^\s]+(?:\s+[^\s]+)?)/);
      if (match) params.to = match[1].replace(/^(with|saying|about|subject)\b/, '').trim();
    } else if (param.name === 'from' && lowerText.includes('from ')) {
      const match = lowerText.match(/from\s+([^\s]+(?:\s+[^\s]+)?)/);
      if (match) params.from = match[1];
    } else if (param.name === 'value' && /\d+/.test(lowerText)) {
      const match = lowerText.match(/(\d+(?:\.\d+)?)/);
      if (match) params.value = parseFloat(match[1]);
    } else if (param.name === 'task' && lowerText.length > 10) {
      const triggers = ['add task', 'create task', 'new task', 'to do', 'remember to'];
      for (const trigger of triggers) {
        if (lowerText.includes(trigger)) {
          const index = lowerText.indexOf(trigger) + trigger.length;
          params.task = text.slice(index).trim().replace(/^to\s+/i, '');
          break;
        }
      }
    } else if (param.name === 'content' && lowerText.length > 10) {
      const triggers = ['create note', 'take a note', 'write note', 'save note'];
      for (const trigger of triggers) {
        if (lowerText.includes(trigger)) {
          const index = lowerText.indexOf(trigger) + trigger.length;
          params.content = text.slice(index).trim();
          break;
        }
      }
    } else if (param.name === 'expression' && /\d+/.test(lowerText)) {
      const mathWords = ['calculate', 'what is', 'compute', 'solve'];
      for (const word of mathWords) {
        if (lowerText.includes(word)) {
          const index = lowerText.indexOf(word) + word.length;
          params.expression = text.slice(index).trim();
          break;
        }
      }
    } else if (param.name === 'query') {
      const triggers = ['search', 'google', 'look up', 'find'];
      for (const trigger of triggers) {
        if (lowerText.includes(trigger)) {
          const index = lowerText.indexOf(trigger) + trigger.length;
          params.query = text.slice(index).trim();
          break;
        }
      }
    } else if (param.name === 'location') {
      const triggers = ['weather', 'forecast'];
      for (const trigger of triggers) {
        if (lowerText.includes(trigger)) {
          const index = lowerText.indexOf(trigger) + trigger.length;
          const location = text.slice(index).trim().replace(/^(in|at|for)\s+/i, '');
          if (location) params.location = location;
          break;
        }
      }
    } else if (param.name === 'minutes' && /\d+\s*(minute|min)/i.test(lowerText)) {
      const match = lowerText.match(/(\d+)\s*(minute|min)/i);
      if (match) params.minutes = parseInt(match[1]);
    } else if (param.name === 'seconds' && /\d+\s*(second|sec)/i.test(lowerText)) {
      const match = lowerText.match(/(\d+)\s*(second|sec)/i);
      if (match) params.seconds = parseInt(match[1]);
    } else if (param.name === 'time' && /\d+/.test(lowerText)) {
      const match = lowerText.match(/(\d+(?::\d+)?(?:\s*(am|pm))?)/i);
      if (match) params.time = match[1];
    }
  }

  return params;
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
  const [exportOpen, setExportOpen] = useState(false);
  const [readAloudEnabled, setReadAloudEnabled] = useState(true);
  const [readingIndex, setReadingIndex] = useState<number | null>(null);
  const [loadingChat, setLoadingChat] = useState(false);

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const isSpeechSupported = !!SpeechRecognition;

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
  const selectedVoiceIdRef = useRef<string>(getStoredVoiceId());
  const readingIndexRef = useRef<number | null>(null);

  // Continue mode = an existing chat was opened from the sidebar.
  useEffect(() => { continueRef.current = !!routeChatId; }, [routeChatId]);

  // Connect read-aloud + voice selection to the user's Settings preference.
  useEffect(() => {
    if (!profile?.id) return;
    getSettings(profile.id).then((s) => {
      const v = s?.preferences?.voice_id;
      if (v) {
        selectedVoiceIdRef.current = v;
        setStoredVoiceId(v);
      }
      setReadAloudEnabled(s?.preferences?.read_aloud_enabled ?? true);
    }).catch(() => {});
  }, [profile?.id]);

  // React live if the voice changes in another tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === VOICE_STORAGE_KEY) selectedVoiceIdRef.current = getStoredVoiceId();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Sync state and muted to refs for the callbacks
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { chatIdRef.current = chatId; }, [chatId]);
  useEffect(() => { startedRef.current = started; }, [started]);

  const voiceLevelRef = useRef(0);
  useEffect(() => { voiceLevelRef.current = voiceLevel; }, [voiceLevel]);

  // Get or create mic stream
  const getMicStream = useCallback(async (): Promise<MediaStream> => {
    if (streamRef.current && streamRef.current.active) return streamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
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
  const speak = useCallback(async (text: string, onWordBoundary?: (spokenText: string) => void): Promise<boolean> => {
    if (!('speechSynthesis' in window)) return false;

    // Stay silent while the user is in another tab/window — they only want to
    // hear the assistant when this app is in front.
    if (document.hidden || !document.hasFocus()) return false;

    try { window.speechSynthesis.cancel(); } catch {}
    try { window.speechSynthesis.resume(); } catch {} // Unpause Chrome's audio queue

    // Browser voices load asynchronously; if none are ready yet, wait for them
    // so we never fall back to a broken default voice.
    const voices = await loadVoices();

    const u = new SpeechSynthesisUtterance(text);
    utteranceRef.current = u; // Prevent garbage collection

    u.rate = continueRef.current ? 0.82 : 0.92;
    u.pitch = 1.0;
    u.volume = 0.9;

    const preferred = pickVoice(selectedVoiceIdRef.current, voices);
    if (preferred) {
      u.voice = preferred;
      console.log("TTS voice selected:", preferred.name, "LocalService:", preferred.localService);
    }

    return new Promise<boolean>((resolve) => {
      let resolved = false;
      const words = text.split(/\s+/).filter(Boolean);
      let wordTimerId: number | undefined;
      let boundaryFired = false;
      const done = () => {
        if (resolved) return;
        resolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        if (wordTimerId !== undefined) clearInterval(wordTimerId);
        utteranceRef.current = null;
        resolve(false);
      };

      u.onend = done;
      u.onerror = done;

      // Word-by-word subtitle reveal kept in exact sync with the audio. The
      // utterance's boundary events fire in real time as each word is actually
      // spoken, so subtitles never run ahead of or behind the voice.
      if (onWordBoundary && words.length) {
        const revealMs = Math.max(2500, words.length * 360);
        const perWordMs = Math.max(100, revealMs / words.length);
        let index = 0;

        // Live sync: reveal everything spoken up to the boundary word.
        u.onboundary = (e: SpeechSynthesisEvent) => {
          if (resolved) return;
          boundaryFired = true;
          if (wordTimerId !== undefined) { clearInterval(wordTimerId); wordTimerId = undefined; }
          const charIndex = e.charIndex ?? 0;
          const charLength = e.charLength ?? 0;
          const end = charIndex + (charLength > 0 ? charLength : 0);
          const spaceIdx = text.indexOf(' ', end);
          const shown = text.slice(0, spaceIdx === -1 ? text.length : spaceIdx + 1).trim();
          onWordBoundary(shown || text.slice(0, charIndex).trim());
        };

        // Fallback revealer — only used if the chosen voice never emits
        // boundary events. Starts instantly so subtitles appear right away.
        onWordBoundary(words[0]);
        wordTimerId = window.setInterval(() => {
          if (boundaryFired) { if (wordTimerId !== undefined) clearInterval(wordTimerId); wordTimerId = undefined; return; }
          index += 1;
          onWordBoundary(words.slice(0, index).join(' '));
          if (index >= words.length && wordTimerId !== undefined) {
            clearInterval(wordTimerId);
            wordTimerId = undefined;
          }
        }, perWordMs);
      }

      // Generous safety timeout so long answers are never cut off:
      // 350ms per word + 8 seconds padding, min 15s.
      const timeoutMs = Math.max(15000, words.length * 350 + 8000);
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
    if (!text.trim()) return;
    processingRef.current = true;

    // First, try to process as a plugin command
    const registry = getPluginRegistry();
    const match = registry.findActionByVoiceTrigger(text);

    if (!match) {
      // The command clearly targets a plugin that isn't connected yet — say
      // what to do instead of letting the AI give a dead-end answer.
      const all = registry.findActionByVoiceTriggerInAll(text);
      if (all && !all.enabled) {
        processingRef.current = false;
        stateRef.current = 'speaking';
        setState('speaking');
        await speak(`The ${all.plugin.config.name} plugin isn't connected yet. Open the Plugins page, click ${all.plugin.config.name}, and press Connect. Then try your command again.`);
        stateRef.current = 'listening';
        setState('listening');
        await new Promise((r) => setTimeout(r, 600));
        if (mutedRef.current || stateRef.current !== 'listening') return;
        startRecognition();
        return;
      }
    }

    if (match) {
      const { plugin, action } = match;

      // Extract parameters: ask the LLM first for accuracy, fall back to fast
      // regex extraction if the LLM isn't available.
      const parsed = await parsePluginCommand(text, plugin.config.id, action);
      const params: Record<string, any> = parsed && Object.keys(parsed).length > 0
        ? parsed
        : extractPluginParamsLegacy(text, action);

      // If required info is missing, ask for it instead of failing silently.
      const missing = action.parameters.filter((p) => p.required && !params[p.name]);
      if (missing.length > 0) {
        const names = missing.map((m) => m.name).join(' and ');
        processingRef.current = false;
        stateRef.current = 'speaking';
        setState('speaking');
        await speak(`I need ${names} for that. Please say it again with that information.`);
        stateRef.current = 'listening';
        setState('listening');
        await new Promise((r) => setTimeout(r, 600));
        if (mutedRef.current || stateRef.current !== 'listening') return;
        startRecognition();
        return;
      }

      try {
        const context = {
          userId: profile?.id || '',
          voiceEngine: null,
          sendMessage: () => {},
        };
        const result = await registry.executeAction(plugin.config.id, action.id, params, context);

        const message = result.success
          ? (result.voiceResponse || 'Done.')
          : `Sorry, that didn't work. ${result.error || 'Unknown error.'}`;

        stateRef.current = 'speaking';
        setState('speaking');
        await speak(message);
        stateRef.current = 'listening';
        setState('listening');
        await new Promise((r) => setTimeout(r, 600));
        if (mutedRef.current || stateRef.current !== 'listening') return;
        startRecognition();
      } catch (error) {
        console.error('Plugin execution error:', error);
        stateRef.current = 'speaking';
        setState('speaking');
        await speak('Sorry, that plugin hit an error. Please try again.');
        stateRef.current = 'listening';
        setState('listening');
        await new Promise((r) => setTimeout(r, 600));
        if (mutedRef.current || stateRef.current !== 'listening') return;
        startRecognition();
      }

      processingRef.current = false;
      return;
    }

    // Create the chat lazily on the first spoken message so an empty session
    // never leaves an empty chat behind.
    if (!chatIdRef.current) {
      const c = await createVoiceChat();
      if (!c) {
        processingRef.current = false;
        stateRef.current = 'listening';
        setState('listening');
        return;
      }
      chatIdRef.current = c.id;
      setChatId(c.id);
      setLastActiveChatId(c.id);
      window.dispatchEvent(new CustomEvent('ksemo-chats-updated'));
    }

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
        messages: [{ role: 'system', content: VOICE_SYSTEM_PROMPT }, ...conversationRef.current.slice(-12)],
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
        // Brief pause so the mic doesn't snap back on the instant speech ends.
        await new Promise((r) => setTimeout(r, 900));
        if (mutedRef.current || stateRef.current !== 'listening') return;
        startRecognition();
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        stateRef.current = 'listening';
        setState('listening');
        await new Promise((r) => setTimeout(r, 500));
        if (mutedRef.current || stateRef.current !== 'listening') return;
        startRecognition();
        return;
      }
      console.error('Voice chat error:', err);
      const errMsg = (err as Error)?.message ?? '';

      // Invalid/expired API key: tell the user and keep listening.
      if (/invalid api key|unauthorized|user not found|api key is invalid/i.test(errMsg)) {
        stateRef.current = 'error';
        setState('error');
        await speak("I couldn't reach the AI service because the Gemini API key is invalid or expired. Please update it in the environment file and refresh the app.");
        stateRef.current = 'listening';
        setState('listening');
        await new Promise((r) => setTimeout(r, 500));
        if (mutedRef.current || stateRef.current !== 'listening') return;
        startRecognition();
        return;
      }

      // Quota / rate limit: let the user know and keep the session running.
      if (/quota|rate limit|too many requests/i.test(errMsg)) {
        stateRef.current = 'error';
        setState('error');
        await speak("The AI service is currently busy or out of quota. Please wait a moment and ask again.");
        stateRef.current = 'listening';
        setState('listening');
        await new Promise((r) => setTimeout(r, 500));
        if (mutedRef.current || stateRef.current !== 'listening') return;
        startRecognition();
        return;
      }

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
    if (!startedRef.current || mutedRef.current || stateRef.current !== 'listening' || !isSpeechSupported) return;

    try { recognitionRef.current?.stop(); } catch { /* ok */ }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-IN';
    recognition.maxAlternatives = 3;

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
      stateRef.current = 'thinking';
      setState('thinking');
      try { recognition.stop(); } catch { /* ok */ }
      processUserSpeech(text);
    };

    recognition.onend = () => {
      console.log("Speech recognition session ended. State:", stateRef.current);
      if (startedRef.current && stateRef.current === 'listening' && !mutedRef.current && recognitionRef.current === recognition) {
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
      if (startedRef.current && stateRef.current === 'listening' && !mutedRef.current && recognitionRef.current === recognition) {
        setTimeout(() => {
          if (startedRef.current && stateRef.current === 'listening' && !mutedRef.current && recognitionRef.current === recognition) {
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

  // Click gesture handler to boot up WebAudio and speech engine.
  // The circle shows instantly; chat creation/reuse happens in the background.
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

    // Reveal the session UI right away so it never feels like it's "loading".
    startedRef.current = true;
    setStarted(true);
    stateRef.current = 'listening';
    setState('listening');

    if (!chatIdRef.current) {
      // Fresh session: the chat is created lazily on the first spoken message,
      // so an empty session never leaves an empty chat behind.
      conversationRef.current = [];
      setHistory([]);
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
      stopAll();
      startedRef.current = false;
      setStarted(false);
      stateRef.current = 'listening';
      setState('listening');
      setAiResponseText('');
      conversationRef.current = [];
      setHistory([]);
      setChatId(routeChatId ?? null);
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
    stopAll();
    startedRef.current = false;
    stateRef.current = 'listening';
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
    await speak(stripMarkdown(content));
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
  }, [started]);

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
            <div className="relative">
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

            {/* Real-time Subtitles / Status Guide (Shown below the circle when started) */}
            {started && (
              <div className="mt-8 text-center animate-fade-in max-w-lg px-4 min-h-[52px]">
                {!isSpeechSupported ? (
                  <p className="text-[13px] font-semibold text-red-400 uppercase">
                    Web Speech API not supported in this browser
                  </p>
                ) : state === 'speaking' ? (
                  <p className="text-sm font-medium leading-relaxed text-ink-100 transition-all duration-300">
                    {aiResponseText}
                  </p>
                ) : state === 'thinking' ? (
                  <p className="text-xs font-semibold tracking-wider text-ink-400 uppercase animate-pulse-soft">
                    Thinking…
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