# KSEMO Live Voice Mode Architecture

KSEMO’s existing Whisper integration transcribes a completed recording; it is retained for manual voice input but cannot provide partial transcription or a continuous conversational audio stream. The existing server-side LLM endpoint already produces genuine streamed text deltas and persists every turn in the active conversation.

The dedicated in-project Voice Mode therefore uses the browser’s continuous speech-recognition capability for live partial and final transcript events, the Web Audio API for an always-visible microphone-level signal, the existing streamed LLM endpoint for each automatically detected turn, and browser speech synthesis for immediate sentence-level verbal output. The microphone session remains active until the user ends Voice Mode. No raw microphone recording is stored in KSEMO’s history.

| Requirement          | In-project implementation                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Continuous listening | One `getUserMedia` stream plus continuous browser speech recognition while Voice Mode is active.                                                     |
| Live transcript      | Browser recognition interim results displayed in the dedicated voice interface.                                                                      |
| Turn detection       | Recognition final results combined with adaptive silence and audio-level activity.                                                                   |
| Assistant response   | Existing authenticated SSE generation stream, with assistant text and transcript saved to the normal conversation.                                   |
| Audible response     | Browser synthesis begins per completed sentence rather than waiting for the full response.                                                           |
| Interruption         | New user speech immediately cancels queued speech and aborts active generation before listening for the next turn.                                   |
| Fallback             | When continuous browser recognition is unavailable, Voice Mode reports the limitation and leaves the existing Whisper push-to-talk option available. |

> A native bidirectional WebRTC voice provider would require a configured realtime STT/TTS or multimodal provider. No such provider credential or realtime gateway is currently configured in the existing project. KSEMO will not represent the fallback as a provider-native audio stream; it remains an actual continuous browser voice session with a clearly surfaced compatibility boundary.
