import { useState, useEffect } from 'react';
import { X, Play, Pause, RotateCcw } from 'lucide-react';
import { getVoiceMemory, VoicePreferences } from '../../lib/voice/VoiceMemory';
import { loadVoices, detectVoices, type DetectedVoice } from '../../lib/voices';

interface VoiceSettingsProps {
  onClose: () => void;
}

export function VoiceSettings({ onClose }: VoiceSettingsProps) {
  const voiceMemory = getVoiceMemory();
  const [preferences, setPreferences] = useState<VoicePreferences>(voiceMemory.getPreferences());
  const [availableVoices, setAvailableVoices] = useState<DetectedVoice[]>([]);
  const [previewVoice, setPreviewVoice] = useState<DetectedVoice | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  useEffect(() => {
    loadVoices().then(voices => {
      const detected = detectVoices(voices, 10);
      setAvailableVoices(detected);
    });
  }, []);

  const handlePreferenceChange = <K extends keyof VoicePreferences>(
    key: K,
    value: VoicePreferences[K]
  ) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    voiceMemory.updatePreferences({ [key]: value });
  };

  const handleVoiceSelect = (voiceId: string) => {
    handlePreferenceChange('voiceId', voiceId);
  };

  const previewVoiceSample = async (voice: DetectedVoice) => {
    if (isPreviewing) {
      window.speechSynthesis.cancel();
      setIsPreviewing(false);
      return;
    }

    setIsPreviewing(true);
    setPreviewVoice(voice);

    const utterance = new SpeechSynthesisUtterance("Hey, I'm Ksemo — this is my voice.");
    utterance.voice = voice.voice;
    utterance.rate = preferences.rate;
    utterance.pitch = preferences.pitch;
    utterance.volume = preferences.volume;

    utterance.onend = () => {
      setIsPreviewing(false);
      setPreviewVoice(null);
    };

    utterance.onerror = () => {
      setIsPreviewing(false);
      setPreviewVoice(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  const resetToDefaults = () => {
    voiceMemory.resetToDefaults();
    setPreferences(voiceMemory.getPreferences());
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Voice Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Voice Selection */}
          <section>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Voice</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {availableVoices.map((voice) => (
                <button
                  key={voice.id}
                  onClick={() => handleVoiceSelect(voice.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    preferences.voiceId === voice.id
                      ? 'border-white bg-white/10'
                      : 'border-white/10 hover:border-white/30 bg-white/5'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-white">{voice.label}</p>
                      <p className="text-xs text-gray-400">{voice.lang}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        previewVoiceSample(voice);
                      }}
                      className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                      disabled={isPreviewing && previewVoice?.id !== voice.id}
                    >
                      {isPreviewing && previewVoice?.id === voice.id ? (
                        <Pause className="w-4 h-4 text-white" />
                      ) : (
                        <Play className="w-4 h-4 text-white" />
                      )}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {voice.neural && (
                      <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
                        Neural
                      </span>
                    )}
                    <span className="text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded-full capitalize">
                      {voice.gender}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Speaking Speed */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-300">Speaking Speed</h3>
              <span className="text-sm text-white">{preferences.rate.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.05"
              value={preferences.rate}
              onChange={(e) => handlePreferenceChange('rate', parseFloat(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0.5x</span>
              <span>1x</span>
              <span>2x</span>
            </div>
          </section>

          {/* Voice Pitch */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-300">Voice Pitch</h3>
              <span className="text-sm text-white">{preferences.pitch.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.05"
              value={preferences.pitch}
              onChange={(e) => handlePreferenceChange('pitch', parseFloat(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Low</span>
              <span>Normal</span>
              <span>High</span>
            </div>
          </section>

          {/* Volume */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-300">Volume</h3>
              <span className="text-sm text-white">{Math.round(preferences.volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={preferences.volume}
              onChange={(e) => handlePreferenceChange('volume', parseFloat(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
            />
          </section>

          {/* Input Mode */}
          <section>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Input Mode</h3>
            <div className="grid grid-cols-3 gap-2">
              {(['hands_free', 'push_to_talk', 'wake_word'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handlePreferenceChange('inputMode', mode)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    preferences.inputMode === mode
                      ? 'bg-white text-black'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {mode === 'hands_free' ? 'Hands Free' : mode === 'push_to_talk' ? 'Push to Talk' : 'Wake Word'}
                </button>
              ))}
            </div>
          </section>

          {/* Silence Duration */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-300">Silence Detection</h3>
              <span className="text-sm text-white">{preferences.silenceDuration}ms</span>
            </div>
            <input
              type="range"
              min="500"
              max="3000"
              step="100"
              value={preferences.silenceDuration}
              onChange={(e) => handlePreferenceChange('silenceDuration', parseInt(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0.5s</span>
              <span>2s</span>
              <span>3s</span>
            </div>
          </section>

          {/* Audio Settings */}
          <section>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Audio Processing</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                <span className="text-sm text-white">Noise Suppression</span>
                <input
                  type="checkbox"
                  checked={preferences.noiseSuppression}
                  onChange={(e) => handlePreferenceChange('noiseSuppression', e.target.checked)}
                  className="w-5 h-5 rounded accent-white"
                />
              </label>
              <label className="flex items-center justify-between p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                <span className="text-sm text-white">Echo Cancellation</span>
                <input
                  type="checkbox"
                  checked={preferences.echoCancellation}
                  onChange={(e) => handlePreferenceChange('echoCancellation', e.target.checked)}
                  className="w-5 h-5 rounded accent-white"
                />
              </label>
              <label className="flex items-center justify-between p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                <span className="text-sm text-white">Auto Gain Control</span>
                <input
                  type="checkbox"
                  checked={preferences.autoGainControl}
                  onChange={(e) => handlePreferenceChange('autoGainControl', e.target.checked)}
                  className="w-5 h-5 rounded accent-white"
                />
              </label>
            </div>
          </section>

          {/* Reset Button */}
          <button
            onClick={resetToDefaults}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}
