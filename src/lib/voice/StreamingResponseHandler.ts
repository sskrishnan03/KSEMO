import { streamChat, type ChatMessage } from '../ai';
import { Emotion } from './types';

export interface StreamingResponseOptions {
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  onToken: (token: string) => void;
  onWord: (word: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: Error) => void;
  emotion?: Emotion;
}

export class StreamingResponseHandler {
  private currentText = '';
  private wordBuffer = '';
  private isStreaming = false;

  async streamResponse(options: StreamingResponseOptions): Promise<void> {
    if (this.isStreaming) return;
    this.isStreaming = true;
    this.currentText = '';
    this.wordBuffer = '';

    try {
      await streamChat({
        model: options.model,
        messages: options.messages,
        signal: options.signal,
        onToken: (token: string) => {
          this.currentText += token;
          this.wordBuffer += token;
          options.onToken(token);

          // Emit complete words
          const words = this.wordBuffer.split(/(\s+)/);
          if (words.length > 1) {
            const completeWord = words.slice(0, -1).join('');
            this.wordBuffer = words[words.length - 1];
            if (completeWord.trim()) {
              options.onWord(completeWord);
            }
          }
        },
        onDone: (full: string) => {
          // Emit any remaining buffered text
          if (this.wordBuffer.trim()) {
            options.onWord(this.wordBuffer);
          }
          options.onDone(full);
        },
        onError: options.onError,
      });

      this.isStreaming = false;
    } catch (error) {
      this.isStreaming = false;
      options.onError(error as Error);
      throw error;
    }
  }

  cancel(): void {
    this.isStreaming = false;
  }

  isActive(): boolean {
    return this.isStreaming;
  }

  getCurrentText(): string {
    return this.currentText;
  }
}

// Helper to adjust AI response based on detected emotion
export function adjustResponseForEmotion(systemPrompt: string, emotion: Emotion): string {
  const emotionAdjustments: Record<Emotion, string> = {
    happy: 'Respond with enthusiasm and warmth. Use an upbeat tone.',
    sad: 'Respond with empathy and gentleness. Use a calm, supportive tone.',
    excited: 'Match their energy with enthusiasm. Be dynamic and engaging.',
    angry: 'Respond calmly and professionally. Acknowledge their feelings without escalating.',
    calm: 'Respond in a measured, thoughtful manner. Be clear and concise.',
    nervous: 'Respond with reassurance and patience. Be supportive and clear.',
    confused: 'Respond with clarity and patience. Break down complex ideas simply.',
    professional: 'Respond professionally and respectfully. Be precise and efficient.',
    friendly: 'Respond warmly and casually. Be approachable and conversational.',
    neutral: 'Respond naturally and helpfully. Be balanced in tone.',
  };

  const adjustment = emotionAdjustments[emotion] || '';
  return adjustment ? `${systemPrompt}\n\n${adjustment}` : systemPrompt;
}
