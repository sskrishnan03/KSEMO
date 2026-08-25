# KSEMO

KSEMO is a full-stack TypeScript application featuring AI-powered conversations, voice interactions, and file management capabilities.

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite
- **Backend**: Express 4, tRPC 11, Node.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Google OAuth + email/password with JWT sessions
- **Features**: AI chat, voice mode, file uploads, conversation management

## Prerequisites

- Node.js 18+
- pnpm package manager
- Supabase project

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd KSEMO
```

2. Install dependencies:

```bash
pnpm install
```

3. Set up environment variables:

Edit `.env` and fill in the required values:

- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (required for backend operations)
- `JWT_SECRET`: Secret for JWT token generation
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `GEMINI_API_KEY`: Google Gemini API key
- `AIML_API_KEY`: AIML API key (fallback)
- `SMTP_USER`: SMTP username for email sending (optional, required for password reset)
- `SMTP_PASS`: SMTP password for email sending (optional, required for password reset)
- `SMTP_FROM`: From email address for password reset emails (optional)
- `SMTP_HOST`: SMTP server host (optional, defaults to Gmail if not set)
- `SMTP_PORT`: SMTP server port (optional, defaults to 465)
- `SERPAPI_API_KEY`: SerpApi key (optional, for web search)

4. Set up the database:

Follow the SQL migration scripts in `supabase-schema/` to set up your Supabase database.

## Development

Run the development server:

```bash
pnpm dev
```

The application will be available at `http://localhost:5173`

## Build

Build for production:

```bash
pnpm build
```

## Production

Start the production server:

```bash
pnpm start
```

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm check` - Type check the code
- `pnpm format` - Format code with Prettier
- `pnpm test` - Run tests

## Deployment

### Render Deployment

This project includes a `render.yaml` configuration file for easy deployment on Render.

1. Connect your repository to Render
2. Render will automatically detect the `render.yaml` file
3. Configure the required environment variables in the Render dashboard
4. Deploy

### Environment Variables for Production

Ensure these environment variables are set in your production environment:

- `NODE_ENV=production`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GEMINI_API_KEY`
- `SMTP_USER` (optional, for password reset emails)
- `SMTP_PASS` (optional, for password reset emails)
- `SMTP_FROM` (optional, for password reset emails)
- `SMTP_HOST` (optional, for password reset emails)
- `SMTP_PORT` (optional, for password reset emails)

## Project Structure

```
KSEMO/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   └── ...
│   └── public/         # Static assets
├── server/             # Express backend
│   ├── routers/        # tRPC routers
│   └── _core/          # Core server utilities
├── shared/             # Shared TypeScript types
├── supabase-schema/    # Database schema and migrations
└── dist/               # Build output (generated)
```

## Features

- **AI Conversations**: Chat with AI assistant with streaming responses
- **Voice Mode**: Continuous voice interaction with speech recognition
- **File Management**: Upload and manage files
- **Conversation Organization**: Pin, archive, and search conversations
- **User Preferences**: Customize AI behavior and interface settings
- **OAuth Authentication**: Secure user authentication

## License

MIT
