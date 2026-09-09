<p align="center">
  <img src="client/public/KSEMOlogo.png" alt="KSEMO" width="100%" />
</p>


<h1 align="center">KSEMO</h1>


<p align="center">
  An intelligent AI assistant platform with durable memory, document creation, voice conversation, and collaborative knowledge management.
</p>


<p align="center">
  <a href="#overview">Overview</a> &nbsp;&middot;&nbsp;
  <a href="#key-features">Features</a> &nbsp;&middot;&nbsp;
  <a href="#how-it-works">How It Works</a> &nbsp;&middot;&nbsp;
  <a href="#installation">Installation</a> &nbsp;&middot;&nbsp;
  <a href="#usage">Usage</a> &nbsp;&middot;&nbsp;
  <a href="#deployment">Deployment</a> &nbsp;&middot;&nbsp;
  <a href="#license">License</a>
</p>


<br/>


## Overview


KSEMO is an AI-powered assistant platform built to replace the need for juggling separate tools for chat, document creation, voice interaction, and personal knowledge management. Everything happens inside a single, unified application with a persistent memory that learns about you over time.


The platform connects to Gemini and AIML language models with automatic failover, streams responses in real time, and generates professional documents directly from conversation. It remembers user preferences and facts across sessions, supports full voice conversations with speech-to-text and text-to-speech, and organizes everything through a project-based workspace with file management.


Whether you are drafting a report, brainstorming ideas, managing a library of reference files, or simply having a conversation, KSEMO gives you a single interface that handles it all — with memory, context, and voice built in from the ground up.


<br/>


## Key Features


**Real-Time Streaming Chat**


Every response streams in real time through Server-Sent Events. You see the assistant think and write as it happens, with no loading spinners or delayed blocks. The system handles model failover transparently — if Gemini is rate-limited, it falls back to Gemini Flash Lite, then to AIML API, with exponential backoff retries across all attempts.


**Durable Memory System**


KSEMO automatically extracts facts from your conversations — your preferences, relationships, habits, and important details — and stores them across sessions. When you start a new conversation, the assistant recalls relevant memories and injects them into context so it remembers who you are and what matters to you. The memory system is opt-in, fully user-controlled, and categorizes entries by sensitivity.


**Document Generation**


Select a format from the chat composer — PDF, Word, Excel, PowerPoint, or Text — and the assistant generates a complete document from your conversation. The pipeline uses LLM-powered content planning followed by deterministic file creation with format-specific libraries, producing professional output with proper headings, tables, lists, and pagination.


**Voice Conversation**


Switch to voice mode for a full-screen conversational experience. Speak naturally and the assistant listens through your microphone, transcribes your speech via Gemini's multimodal API, processes your request, and speaks the response back. It supports barge-in detection so you can interrupt mid-speech, and shows live subtitles during playback.


**File Library**


Upload files up to 25MB — PDFs, documents, spreadsheets, presentations — and the platform automatically extracts their text content. Attach files to conversations to give the assistant direct context from your documents. Browse your library with grid or list views, search by name, and mark files as favorites.


**Smart Keyboard Shortcuts**


Navigate the entire application without touching the mouse. `Cmd+K` focuses the composer, `Cmd+Shift+O` opens a new chat, `Cmd+Shift+P/D/X/S` switches to PDF/DOCX/XLSX/PPTX mode instantly. All shortcuts are documented and configurable through the settings panel.


**Collaborative Sharing**


Generate public links to any conversation and share them with anyone. Recipients can view the full conversation thread in a read-only format. Share via email directly from the platform with styled HTML notifications.


**Theme and Appearance**


Switch between light, dark, and system-preferred themes. The entire UI adapts with smooth transitions powered by CSS custom properties and Tailwind's theme system.


**Settings and Preferences**


A comprehensive settings dialog covers account management, password changes, appearance customization, AI model selection, persona configuration (balanced, concise, creative, analytical), custom instructions, speech rate, memory controls, and full data export.


<br/>


## How It Works


**1. Sign In and Authenticate**


Create an account with your email and password, or sign in through Google OAuth or the platform's built-in OAuth portal. Sessions are managed through JWT tokens stored in HttpOnly cookies with CSRF protection. The system supports three authentication tiers: public, authenticated, and admin.


**2. Start a Conversation**


Open the main chat interface and begin typing. The assistant streams responses in real time through Server-Sent Events. Every conversation is saved automatically, and the system generates an intelligent title from your first exchange.


**3. Use Document Modes**


Click the plus menu in the composer and select a document format. Type your request — "Create a quarterly sales report as Excel" — and the platform's document generation pipeline kicks in. The LLM plans the content structure, validates it against a specification schema, then generates the file deterministically. You receive a download card once the file is ready.


**4. Upload and Reference Files**


Open the Library workspace to upload documents. The platform extracts text from PDFs, Word files, spreadsheets, and presentations. Attach any file to a conversation and the assistant reads its content as context when responding to your messages.


**5. Talk with Voice**


Press the voice button or switch to full voice mode. The platform records your speech through the microphone, sends the audio to Gemini's multimodal API for transcription, and processes the text as a normal message. In full voice mode, the response is spoken back to you with an animated visual indicator and live subtitles.


**6. Leverage Memory**


Enable the memory system in Settings and the platform begins automatically extracting facts from your conversations. Over time it builds a profile of your preferences and context. In future conversations, relevant memories are silently retrieved and added to the assistant's system prompt so responses feel personal and continuous.


**7. Organize with Projects**


Group conversations into projects for better organization. Each project can hold multiple conversations, and files can be associated at both the project and conversation level. Archive projects you are done with or restore them when needed.


**8. Share and Export**


Toggle public sharing on any conversation to generate a shareable link. Export conversations as PDF or Word documents. Share via email with styled HTML messages sent through the integrated SMTP service.


<br/>


## Project Structure


```
KSEMO/
├── client/                     # React SPA frontend
│   ├── index.html
│   ├── public/                 # Static assets (logo)
│   └── src/
│       ├── main.tsx            # React root, tRPC + QueryClient setup
│       ├── App.tsx             # Router (wouter Switch)
│       ├── index.css           # Tailwind config, theme tokens
│       ├── const.ts            # OAuth helpers
│       ├── _core/hooks/        # useAuth hook
│       ├── contexts/           # ThemeContext (light/dark)
│       ├── hooks/              # Voice, shortcuts, composition hooks
│       ├── pages/              # Route pages
│       ├── lib/                # Utilities (tRPC client, exports, capabilities)
│       └── components/
│           ├── ui/             # shadcn/ui primitives
│           ├── ksemo/          # Domain components
│           └── voice/          # Voice chat UI
├── server/                     # Express backend
│   ├── _core/                  # Server bootstrap, LLM, auth, mailer, middleware
│   ├── routers/                # tRPC routers (auth, conversations, memory, workspace)
│   ├── memory/                 # Memory extraction and retrieval
│   ├── docgen/                 # Document generation pipeline
│   ├── chatStream.ts           # SSE chat streaming endpoint
│   ├── supabase-db.ts          # Database abstraction (Supabase + in-memory)
│   ├── inMemoryStore.ts        # In-memory data store
│   ├── storage.ts              # Local file storage engine
│   └── fileExtract.ts          # Text extraction from uploaded files
├── shared/                     # Shared types and constants (client + server)
│   ├── _core/errors.ts         # HTTP error classes
│   ├── capabilities.ts         # File creation mode types
│   ├── const.ts                # OAuth state, cookie names, timeouts
│   └── memory.ts               # Memory categories and limits
├── supabase-schema/            # Database schema (SQL + TypeScript types)
├── components.json             # shadcn/ui configuration
├── metadata.json               # Platform capability metadata
├── render.yaml                 # Render deployment config
├── vite.config.ts              # Vite build config
├── vitest.config.ts            # Test config
└── tsconfig.json               # TypeScript config
```


<br/>


## Tech Stack


| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS v4, wouter |
| Backend | Express 4, tRPC 11, SSE streaming |
| Database | Supabase (PostgreSQL) with in-memory fallback |
| AI | Gemini API (primary), AIML API (fallback) |
| Auth | JWT (jose), OAuth 2.0 (Google + generic), email/password |
| UI | shadcn/ui (Radix UI), framer-motion, lucide-react |
| Voice | Gemini multimodal API, Web Speech API, SpeechSynthesis |
| Documents | pdf-lib, docx, xlsx, pptxgenjs |
| Package Manager | pnpm 10 |
| Deployment | Render (Node.js) |


<br/>


## Features in Detail


### Chat Streaming


The core chat runs through `POST /api/chat/stream` using Server-Sent Events. The server authenticates the user, saves the message, assembles a system prompt from the base instruction, current date/time, user persona, custom instructions, and retrieved memory context, then streams the LLM response token by token.


**SSE event types:**
- `conversation` — conversation metadata on first response
- `assistant.delta` — streaming text chunk
- `assistant.completed` — full response ready
- `assistant.error` — error occurred
- `assistant.modelFallback` — switched to fallback model
- `file.progress` / `file.created` / `file.error` — document generation lifecycle
- `conversation.titleUpdated` — auto-generated conversation title

**Model failover:** Gemini Flash → Gemini Flash Lite (free tier) → AIML API, with equal-jitter exponential backoff (up to 4 retries per provider).


### Document Generation Pipeline


File creation is triggered by selecting a mode in the chat composer or by keyword detection in the message. The pipeline runs in five stages:


1. **Detect** — Heuristic keyword matching identifies file-creation intent and extracts format hints
2. **Plan** — LLM generates a structured content plan with headings, paragraphs, tables, and lists
3. **Spec** — The plan is coerced and validated into a format-agnostic `DocumentSpec`
4. **Generate** — A deterministic generator produces the actual file using format-specific libraries
5. **Store** — The file is saved locally, registered in the database, and attached to the assistant message


| Format | Library | Capabilities |
|---|---|---|
| PDF | pdf-lib | Full pagination, headings, tables, page numbers |
| DOCX | docx | Headings, tables, bullet and numbered lists |
| XLSX | xlsx | Multi-sheet, auto-table parsing |
| PPTX | pptxgenjs | 16:9 layout, tables, bullet slides |
| TXT / MD | Plain text | Markdown-formatted content |


### Memory System


The memory system operates in three phases running silently in the background after every chat turn:


**Extraction** — A rule-based engine (no LLM calls) scans user messages for durable facts across eight categories: general, preference, personal, health, religion, politics, financial, and relationship. Sensitive categories are flagged and gated behind explicit user consent.


**Storage** — Extracted facts are saved with a title, content, category, source (manual or chat), and consent status. Users can browse all stored memories, toggle the master switch, and control whether chat-based extraction is active.


**Retrieval** — Before each response, the system tokenizes the conversation, scores stored memories by relevance (title match +2, content match +1, exact substring +3), and injects the top results (max 2000 characters) into the system prompt. Memories that are no longer relevant are excluded.


### Voice


**Push-to-talk input** — Press and hold the microphone button in the chat composer. Audio is recorded through the Web Audio API, sent to Gemini's multimodal transcription endpoint, and the resulting text is inserted into the composer as a regular message. Supports webm, ogg, mpeg, wav, and mp4 formats up to 12MB with a 45-second deadline.


**Full voice conversation** — Enter voice mode for a dedicated full-screen experience. The system cycles through listen → process → speak with an animated orb visualizer. It uses the Web Speech API for browser-native recognition, falls back to MediaRecorder for unsupported browsers, and uses SpeechSynthesis for playback. Barge-in detection lets you interrupt the assistant mid-speech. Subtitles display during playback for accessibility.


### File Library


Files are stored in the `.ksemo-uploads/` directory, namespaced by user and type. The platform extracts text content from uploaded files for AI context:


| Format | Extraction Library |
|---|---|
| PDF | unpdf |
| DOCX | mammoth |
| XLSX / XLS | xlsx (up to 20 sheets, 2000 rows each) |
| PPTX | jszip (XML parsing) |
| Plain text | Binary detection + UTF-8 decode |

Maximum extraction cap is 200,000 characters per file. Files can be attached to conversations, favorited, searched, and displayed in grid or list views.


### Authentication and Security


| Feature | Detail |
|---|---|
| JWT signing | HS256 with configurable secret |
| Token storage | HttpOnly cookies with `Partitioned` flag for iframe support |
| Session expiry | 1 year |
| CSRF protection | OAuth state nonce bound to a one-time cookie |
| Password hashing | scrypt (16-byte random salt, 64-byte key, timing-safe comparison) |
| Password reset | SHA-256 token with 1-hour TTL, emailed via SMTP |
| Google OAuth | Standard authorization code flow with state nonce |
| tRPC middleware | `publicProcedure`, `protectedProcedure` (auth required), `adminProcedure` (admin role required) |


### Database Schema


15 tables with Row Level Security enabled on every table. Users can only access their own data through Supabase RLS policies.


| Table | Purpose |
|---|---|
| `users` | Identity, auth credentials, roles (user/admin) |
| `user_preferences` | Model selection, persona, custom instructions, speech rate |
| `memory_settings` | Per-user memory toggle (all off by default) |
| `conversations` | Chat threads (text/voice/mixed), pinning, archiving, soft delete, public sharing |
| `messages` | Chat messages with role, status, model info |
| `message_versions` | Edit history for messages |
| `message_feedback` | Thumbs up/down on assistant messages |
| `memories` | User-controlled persistent memories |
| `conversation_memories` | AI-extracted facts from conversations |
| `projects` | Organizational containers for conversations |
| `files` | Uploaded files with metadata and extracted text |
| `attachments` | Links files to conversations and messages |
| `voice_sessions` | Voice call state tracking |
| `tasks` | Task management with status and priority |
| `task_activities` | Activity log for task execution |


Database functions include `search_messages`, `search_conversation_titles`, `get_public_conversation_by_token`, `move_conversation_to_trash`, `restore_conversation`, `set_message_feedback`, `generate_share_token`, and `upsert_user_preferences`.


### Client Routes


| Path | Component | Description |
|---|---|---|
| `/` | Home | Main chat interface (requires auth) |
| `/share/:token` | SharedConversation | Public shared conversation view |
| `/support/faq` | FaqPage | FAQ with search and assistant chatbot |
| `/support/privacy` | PrivacyPage | Privacy Policy |
| `/support/terms` | TermsPage | Terms of Service |
| `/signin` | AuthStage | Sign-in |
| `/signup` | AuthStage | Sign-up |
| `/forgot-password` | AuthStage | Forgot password |
| `/reset-password` | ResetPassword | Token-based password reset |
| `/404` | NotFound | 404 page |


### tRPC API Endpoints


| Router | Procedures |
|---|---|
| `system` | `health`, `notifyOwner` (admin only) |
| `auth` | `me`, `logout`, `signUp`, `signIn`, `requestPasswordReset`, `resetPassword`, `changePassword`, `updateProfile`, `deleteAccount` |
| `conversation` | `list`, `create`, `get`, `rename`, `setPinned`, `setArchived`, `trash`, `restore`, `remove`, `removeAll`, `duplicate`, `export`, `configurePublicShare`, `getPublic`, `search`, `getAllConversations` |
| `message` | `remove`, `edit`, `history`, `restoreVersion`, `feedback` |
| `preferences` | `get`, `update`, `models` |
| `memory` | `settings.get`, `settings.update`, `list` |
| `voice` | `sessionStart`, `sessionStatus`, `transcribe` |
| `fileGeneration` | `generate` |
| `workspace.projects` | `list`, `create`, `update`, `archive`, `remove`, `conversations`, `setConversation` |
| `workspace.files` | `list`, `setFavorite`, `upload`, `remove`, `attachToConversation` |
| `workspace.data` | `exportAll` |


### Express Routes


| Method | Path | Description |
|---|---|---|
| `GET` | `/api/oauth/callback` | Generic OAuth callback |
| `GET` | `/api/auth/google` | Start Google OAuth flow |
| `GET` | `/api/auth/google/callback` | Google OAuth callback |
| `POST` | `/api/chat/stream` | SSE chat streaming endpoint |
| `GET` | `/ksemo-storage/*` | Local file storage proxy |


<br/>


## Installation


**Prerequisites**


- Node.js (v18 or higher)
- pnpm 10


**Clone and Install**


```bash
git clone https://github.com/your-username/KSEMO.git
cd KSEMO

pnpm install
```


**Environment Configuration**


Create a `.env` file in the project root with the following variables:


| Variable | Purpose |
|---|---|
| `JWT_SECRET` | JWT signing secret |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_OAUTH_REDIRECT_URI` | OAuth callback URL (e.g., `http://localhost:3000/api/auth/google/callback`) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (optional — uses in-memory store when absent) |
| `LLM_BASE_URL` | LLM API base URL |
| `GEMINI_API_KEY` | Gemini API key |
| `AIML_API_KEY` | AIML API key (fallback provider) |
| `AIML_MODEL` | AIML model identifier |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM` | Sender email address |
| `VITE_APP_ID` | Application identifier |


<br/>


## Usage


Once the application is running, you will land on the main chat interface after signing in.


**Start a Conversation**


Type a message and press Enter. The assistant responds in real time with streaming text. Your conversation is saved automatically with an AI-generated title.


**Generate Documents**


Click the plus menu in the composer and select a format (PDF, Word, Excel, PowerPoint, or Text). Type your request and the assistant generates a downloadable file.


**Upload Files**


Open the Library workspace from the sidebar. Upload files up to 25MB. Attach any file to a conversation to give the assistant context from your documents.


**Voice Input**


Hold the microphone button in the composer to record your voice. The audio is transcribed and inserted as text. Enter full voice mode for a hands-free conversation experience.


**Manage Conversations**


Use the sidebar to pin, archive, rename, duplicate, export, or delete conversations. Search across all your messages with `Cmd+K`.


**Share Conversations**


Open the share dialog on any conversation to generate a public link or send it via email.


**Adjust Settings**


Open the settings dialog with `Cmd+,` to change your theme, AI model, persona, custom instructions, speech rate, memory settings, and more. Export or delete your account data from the Data tab.


**Keyboard Shortcuts**


| Shortcut | Action |
|---|---|
| `Cmd+K` | Focus chat composer |
| `Cmd+Shift+O` | New conversation |
| `Cmd+,` | Open settings |
| `Cmd+B` | Toggle sidebar |
| `Cmd+Shift+P` | Switch to PDF mode |
| `Cmd+Shift+D` | Switch to Word mode |
| `Cmd+Shift+X` | Switch to Excel mode |
| `Cmd+Shift+S` | Switch to PowerPoint mode |
| `Escape` | Stop streaming |


<br/>


## Deployment


The project is configured for deployment on Render via `render.yaml`.


| Setting | Value |
|---|---|
| Service type | Web |
| Runtime | Node.js |
| Build command | `pnpm install --prod=false && pnpm build` |
| Start command | `pnpm start` |
| Port | 3000 |
| Production URL | https://ksemo.onrender.com |


**Build commands:**


```bash
pnpm build       # Vite + esbuild production build
pnpm start       # Run production server
```


**Development:**


```bash
pnpm dev         # Vite dev server + Express API on port 3000
pnpm check       # TypeScript type checking
pnpm format      # Prettier formatting
pnpm test        # Vitest test suite
```


<br/>


## License


MIT


<br/>


<div align="center">
  <sub>KSEMO</sub>
  <br/>
  <sub>&copy; 2026</sub>
</div>
