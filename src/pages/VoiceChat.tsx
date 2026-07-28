import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTheme } from '../components/ThemeProvider';
import { createChat, insertMessage, updateChat, logUsage, listChats, setLastActiveChatId } from '../lib/data';
import type { Chat } from '../lib/types';
import { streamChat, type ChatMessage } from '../lib/ai';
import { estimateTokens } from '../lib/utils';

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
  const { resolvedTheme } = useTheme();
  const [state, setState] = useState<VoiceState>('listening');
  const [muted, setMuted] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [chatId, setChatId] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [aiResponseText, setAiResponseText] = useState('');

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

  // Sync state and muted to refs for the callbacks
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { chatIdRef.current = chatId; }, [chatId]);

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
      
      u.rate = 0.95;
      u.pitch = 0.85;
      u.volume = 1.0;
      
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
    if (!text.trim() || !chatIdRef.current) return;

    stateRef.current = 'thinking';
    setState('thinking');
    try { recognitionRef.current?.stop(); } catch {}

    conversationRef.current.push({ role: 'user', content: text });
    await insertMessage({ chat_id: chatIdRef.current, role: 'user', content: text });

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

      await insertMessage({ chat_id: chatIdRef.current, role: 'assistant', content: result.content, model: 'ksemo-pro', tokens: result.tokens });
      await logUsage('ksemo-pro', estimateTokens(text), result.tokens, result.latencyMs);

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

    let finalTranscript = '';

    recognition.onstart = () => {
      console.log("Speech recognition session started successfully");
    };

    recognition.onresult = (event: any) => {
      if (recognitionRef.current !== recognition) return; // Ignore events from old instances
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript.trim()) {
        reconnectAttemptsRef.current = 0;
        stateRef.current = 'thinking';
        setState('thinking');
        try { recognition.stop(); } catch { /* ok */ }
        processUserSpeech(finalTranscript);
      }
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

    const chats = await listChats();
    const existingEmpty = chats.find((c) => c.title === 'New chat');
    let c: Chat | null;
    if (existingEmpty) {
      c = existingEmpty;
    } else {
      c = await createChat();
    }
    if (!c) return;
    setChatId(c.id);
    setLastActiveChatId(c.id);
    conversationRef.current = [];
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

  // End session → convert to normal chat
  const endSession = useCallback(async () => {
    stopAll();
    setStarted(false);

    if (chatIdRef.current && conversationRef.current.length > 0) {
      const firstUser = conversationRef.current.find((m) => m.role === 'user');
      const title = firstUser
        ? firstUser.content.slice(0, 48) + (firstUser.content.length > 48 ? '…' : '')
        : 'Voice Chat';
      await updateChat(chatIdRef.current, { title });
      nav(`/app/chat/${chatIdRef.current}`);
    } else if (chatIdRef.current) {
      nav('/app');
    } else {
      nav('/app');
    }
  }, [nav, stopAll]);

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

  // Real-time animation amplitude loop & Canvas Fluid Circle Renderer
  useEffect(() => {
    if (!hasKey) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;
    let time = 0;
    const dataArray = new Uint8Array(128);

    const render = () => {
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
  }, [hasKey, started, resolvedTheme]);

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

  return (
    <div className="h-full w-full bg-transparent flex flex-col items-center justify-between overflow-hidden py-8 px-6 select-none animate-fade-in">
      
      {/* Top spacer */}
      <div className="h-6" />

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
                  // Hide listening status text completely, keeping a spacer to prevent layout shift
                  <div className="h-5" />
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



    </div>
  );
}
