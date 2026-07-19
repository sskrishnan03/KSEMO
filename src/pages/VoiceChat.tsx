import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, PhoneOff } from 'lucide-react';
import { cn } from '../lib/utils';
import { createChat, insertMessage, updateChat, logUsage } from '../lib/data';
import { streamChat, type ChatMessage } from '../lib/ai';
import { estimateTokens } from '../lib/utils';

type VoiceState = 'listening' | 'thinking' | 'speaking' | 'error' | 'reconnecting';

const BARGE_IN_THRESHOLD = 0.08;
const SILENCE_TIMEOUT_MS = 8000;
const RECONNECT_DELAY_MS = 1500;
const MAX_RECONNECT_ATTEMPTS = 5;

export default function VoiceChat() {
  const nav = useNavigate();
  const [state, setState] = useState<VoiceState>('listening');
  const [muted, setMuted] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  const [chatId, setChatId] = useState<string | null>(null);
  const [waveFrame, setWaveFrame] = useState(0);

  const recognitionRef = useRef<any>(null);
  const abortRef = useRef<AbortController | null>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const conversationRef = useRef<ChatMessage[]>([]);
  const stateRef = useRef<VoiceState>('listening');
  const mutedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const exchangesRef = useRef(0);
  const totalTokensRef = useRef(0);
  const chatIdRef = useRef<string | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speakingStartRef = useRef(0);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { chatIdRef.current = chatId; }, [chatId]);

  // Duration timer
  useEffect(() => {
    durationRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => { if (durationRef.current) clearInterval(durationRef.current); };
  }, []);

  // Wave frame animation
  useEffect(() => {
    let raf: number;
    const tick = () => { setWaveFrame((f) => f + 1); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // Get or create mic stream with audio preprocessing
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

  // Voice level analyser + VAD
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
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length / 255;
        setVoiceLevel(avg);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* mic permission denied or error */ }
  }, [getMicStream]);

  const stopAnalyser = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    analyserRef.current = null;
    setVoiceLevel(0);
  }, []);

  // Check if user is currently speaking (VAD)
  const isUserSpeaking = useCallback((): boolean => {
    const analyser = analyserRef.current;
    if (!analyser) return false;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const avg = data.reduce((a, b) => a + b, 0) / data.length / 255;
    return avg > BARGE_IN_THRESHOLD;
  }, []);

  // TTS with interruption support
  const speak = useCallback((text: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) { resolve(false); return; }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95;
      u.pitch = 0.85;
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => /daniel|alex|james|matthew|thomas|google.*male|google.*gb|en-gb.*male/i.test(v.name) && v.lang.startsWith('en'))
        || voices.find(v => /david|mark|richard|daniel|google.*english|samantha|en-us/i.test(v.name) && v.lang.startsWith('en'))
        || voices.find(v => v.lang.startsWith('en'));
      if (preferred) u.voice = preferred;

      let interrupted = false;

      // Barge-in detection while speaking
      const bargeInterval = setInterval(() => {
        if (stateRef.current !== 'speaking') {
          clearInterval(bargeInterval);
          return;
        }
        if (isUserSpeaking()) {
          interrupted = true;
          window.speechSynthesis?.cancel();
          clearInterval(bargeInterval);
        }
      }, 150);

      u.onend = () => { clearInterval(bargeInterval); resolve(interrupted); };
      u.onerror = () => { clearInterval(bargeInterval); resolve(interrupted); };
      window.speechSynthesis.speak(u);
    });
  }, [isUserSpeaking]);

  // Process user speech → AI → TTS → listen again
  const processUserSpeech = useCallback(async (text: string) => {
    if (!text.trim() || !chatIdRef.current) return;

    conversationRef.current.push({ role: 'user', content: text });
    setState('thinking');
    await insertMessage({ chat_id: chatIdRef.current, role: 'user', content: text });

    const controller = new AbortController();
    abortRef.current = controller;
    let streamBuffer = '';

    try {
      const result = await streamChat({
        model: 'ksemo-pro',
        messages: [...conversationRef.current],
        signal: controller.signal,
        onToken: (t) => { streamBuffer += t; },
      });

      if (controller.signal.aborted) return;

      conversationRef.current.push({ role: 'assistant', content: result.content });
      exchangesRef.current += 1;
      totalTokensRef.current += result.tokens;

      await insertMessage({ chat_id: chatIdRef.current, role: 'assistant', content: result.content, model: 'ksemo-pro', tokens: result.tokens });
      await logUsage('ksemo-pro', estimateTokens(text), result.tokens, result.latencyMs);

      setState('speaking');
      speakingStartRef.current = Date.now();
      const wasInterrupted = await speak(result.content);

      if (wasInterrupted) {
        // User barged in — go straight to listening
        setState('listening');
        startRecognition();
      } else {
        setState('listening');
        startRecognition();
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // Barge-in during AI streaming — listen immediately
        setState('listening');
        startRecognition();
        return;
      }
      // Network error — attempt reconnect
      console.error('Voice chat error:', err);
      setState('error');
      await new Promise((r) => setTimeout(r, RECONNECT_DELAY_MS));
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current += 1;
        setState('reconnecting');
        await new Promise((r) => setTimeout(r, 500));
        setState('listening');
        startRecognition();
      }
    }
  }, [speak]);

  // Silence detection
  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      // Silence timeout — keep listening, just a natural pause
      // The speech recognition will auto-restart via onend
    }, SILENCE_TIMEOUT_MS);
  }, []);

  // Start speech recognition
  const startRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    // Stop existing
    try { recognitionRef.current?.stop(); } catch { /* ok */ }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    let finalTranscript = '';

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript.trim()) {
        reconnectAttemptsRef.current = 0;
        try { recognition.stop(); } catch { /* ok */ }
        processUserSpeech(finalTranscript);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still listening
      if (stateRef.current === 'listening' && recognitionRef.current) {
        try { recognition.start(); } catch { /* already started */ }
        resetSilenceTimer();
      }
    };

    recognition.onerror = (e: any) => {
      if (e.error === 'not-allowed') {
        setState('error');
        return;
      }
      if (stateRef.current === 'listening') {
        setTimeout(() => {
          if (stateRef.current === 'listening') {
            try { recognition.start(); } catch { /* ok */ }
          }
        }, 200);
      }
    };

    recognitionRef.current = recognition;
    try { recognition.start(); } catch { /* ok */ }
    resetSilenceTimer();
  }, [processUserSpeech, resetSilenceTimer]);

  const stopAll = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { /* ok */ }
    recognitionRef.current = null;
    stopAnalyser();
    window.speechSynthesis?.cancel();
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, [stopAnalyser]);

  // Auto-start on mount
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const c = await createChat({ title: 'Voice Chat', type: 'voice' });
      if (cancelled || !c) return;
      setChatId(c.id);
      conversationRef.current = [];
      exchangesRef.current = 0;
      totalTokensRef.current = 0;
      reconnectAttemptsRef.current = 0;
      await startAnalyser();
      startRecognition();
    };
    init();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopAll(); if (durationRef.current) clearInterval(durationRef.current); };
  }, []);

  // End session → convert to normal chat
  const endSession = useCallback(async () => {
    stopAll();
    if (durationRef.current) clearInterval(durationRef.current);

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
  }, [duration, nav, stopAll]);

  // Particles
  const particles = useMemo(() =>
    Array.from({ length: 24 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1 + Math.random() * 2.5,
      delay: Math.random() * 8,
      duration: 6 + Math.random() * 10,
    })), []);

  const isError = state === 'error';
  const isReconnecting = state === 'reconnecting';

  return (
    <div className="h-screen flex flex-col items-center justify-center relative overflow-hidden vc-bg">
      <div className="vc-radial" />
      <div className="vc-gradient" />

      {/* Particles */}
      <div className="vc-particles">
        {particles.map((p) => (
          <div key={p.id} className="vc-particle" style={{
            left: `${p.x}%`, top: `${p.y}%`,
            width: p.size, height: p.size,
            animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s`,
          }} />
        ))}
      </div>

      {/* Duration */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 animate-fade-in">
        <span className={cn('h-1.5 w-1.5 rounded-full animate-pulse-soft', isError ? 'bg-red-400' : 'bg-white')} />
        <span className="text-[12px] text-ink-300 font-mono tracking-wider">{formatDuration(duration)}</span>
        {exchangesRef.current > 0 && (
          <span className="text-[11px] text-ink-400 ml-2">{exchangesRef.current} exchange{exchangesRef.current !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Orb area */}
      <div className="relative flex items-center justify-center">
        {/* Ripples — listening */}
        {state === 'listening' && (
          <>
            <div className="vc-ripple vc-ripple-1" />
            <div className="vc-ripple vc-ripple-2" />
            <div className="vc-ripple vc-ripple-3" />
          </>
        )}

        {/* Thinking ring */}
        {state === 'thinking' && <div className="vc-think-ring" />}

        {/* Error ring */}
        {isError && <div className="vc-error-ring" />}

        {/* Reconnecting spinner */}
        {isReconnecting && <div className="vc-think-ring" style={{ borderColor: 'rgba(251,191,36,0.5)' }} />}

        {/* Waveform */}
        {(state === 'listening' || state === 'speaking') && (
          <svg className="vc-waveform" viewBox="0 0 200 200" key={waveFrame}>
            {Array.from({ length: 64 }, (_, i) => {
              const angle = (i / 64) * Math.PI * 2;
              const baseR = 72;
              const amp = state === 'speaking' ? voiceLevel * 20 : voiceLevel * 14;
              const h = 2 + Math.sin(angle * 4 + waveFrame * 0.08) * amp;
              const x1 = 100 + Math.cos(angle) * baseR;
              const y1 = 100 + Math.sin(angle) * baseR;
              const x2 = 100 + Math.cos(angle) * (baseR + h);
              const y2 = 100 + Math.sin(angle) * (baseR + h);
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeOpacity={0.25 + voiceLevel * 0.45} strokeWidth={1.5} strokeLinecap="round" />;
            })}
          </svg>
        )}

        {/* Main orb */}
        <div
          className={cn(
            'vc-orb',
            state === 'listening' && 'vc-orb-listening',
            state === 'thinking' && 'vc-orb-thinking',
            state === 'speaking' && 'vc-orb-speaking',
            isError && 'vc-orb-error',
            isReconnecting && 'vc-orb-thinking',
          )}
          style={state === 'speaking' ? { transform: `scale(${1 + voiceLevel * 0.1})` } : undefined}
        >
          <div className="vc-orb-inner">
            <span className="font-bold text-white text-[28px] tracking-tight select-none">K</span>
          </div>
          <div className="vc-orb-glow" style={{ opacity: isError ? 0.15 : 0.35 + voiceLevel * 0.45 }} />
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-8 md:bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4">
        <button
          onClick={() => setMuted((m) => !m)}
          className={cn('vc-ctrl', muted && 'vc-ctrl-active')}
          aria-label={muted ? 'Unmute mic' : 'Mute mic'}
        >
          {muted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        <button onClick={endSession} className="vc-end" aria-label="End voice chat">
          <PhoneOff size={18} />
        </button>
      </div>
    </div>
  );
}
