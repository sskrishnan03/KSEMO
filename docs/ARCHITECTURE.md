# KSEMO Architecture

## Current foundation

KSEMO is built on a React 19 and TypeScript client, an Express 4 and tRPC 11 server, Drizzle ORM, and a MySQL-compatible database. KSEMO OAuth is already configured as the sole authentication mechanism. Every application procedure that accesses user data will run through the authenticated server boundary, and the browser will never receive the AI or transcription credentials.

The template includes a markdown-capable chat component, a responsive authenticated sidebar shell, a server-side LLM helper, storage helpers, and a Whisper transcription helper. The chat component is retained only as a technical reference; KSEMO uses a dedicated conversation interface so the persistence, streaming, voice, and message action states remain coherent.

## Application boundaries

| Layer  | Responsibility                                                                        | KSEMO implementation                                                                                                   |
| ------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Client | Interaction, rendering, microphone capture, browser speech playback                   | React feature components, typed tRPC calls, `MediaRecorder`, and the Web Speech API where supported.                   |
| Server | Authorization, conversation orchestration, streaming proxying, transcription dispatch | Protected tRPC procedures plus one authenticated streaming endpoint.                                                   |
| Data   | Durable user-owned records and search                                                 | Drizzle tables for conversations, messages, and preferences, all filtered by the authenticated user.                   |
| AI     | Text generation with configurable behavior and model selection                        | Server-side LLM adapter that composes a system instruction and prior conversation messages.                            |
| Voice  | User-controlled audio capture and speech-to-text                                      | Browser recording uploaded only for Whisper transcription; the recording is not represented as permanent history data. |

## Relational model

| Table             | Purpose                          | Important fields and constraints                                                                                                  |
| ----------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `conversations`   | A user-owned chat session        | UUID, owner `userId`, title, conversation type, pinned/archive flags, timestamps, and owner-scoped list indexes.                  |
| `messages`        | Ordered immutable chat turns     | UUID, conversation reference, role, markdown content, model, lifecycle status, timestamps, and searchable content.                |
| `userPreferences` | Personal assistant configuration | One row per user containing the selected model, persona, custom system instruction, voice preferences, and interface preferences. |

Conversation, message, preference, search, and mutation queries must all confirm ownership from the authenticated server context. The client sends only a conversation identifier and user input; it does not choose arbitrary prior histories or provide secret prompts.

## Generation and voice flows

For text, KSEMO persists the user message, builds the server-controlled system prompt from the user's saved preferences, retrieves the conversation context in chronological order, and opens an authenticated server-sent event stream to the LLM adapter. The UI updates the active assistant message on each valid delta. When the stream closes, the final assistant content and status are persisted. Cancellation aborts the upstream request and records a cancelled rather than completed status.

For voice input, the browser shows an explicit recording state, captures a supported audio format, validates the recording size before upload, and sends it to the server. The server stores the temporary file using the configured storage service and forwards its protected URL to the built-in Whisper service. A successful transcript becomes editable composer text; the user decides whether to submit it. Browser speech synthesis reads an existing assistant message locally only after a user action or a saved autoplay preference.

## Implementation sequence

The work proceeds by establishing ownership-safe persistence, then server-side streaming, then the refined conversation interface and search, followed by Whisper recording, speech playback, and preference controls. Tests cover server authorization and message lifecycle transitions; visual checks cover desktop and mobile layouts, focus visibility, empty states, and voice permission failures.
