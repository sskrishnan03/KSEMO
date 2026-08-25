# KSEMO

KSEMO is a full-stack TypeScript application featuring AI-powered conversations, voice interactions, and file management capabilities.

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite
- **Backend**: Express 4, tRPC 11, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: OAuth-based authentication
- **Features**: AI chat, voice mode, file uploads, conversation management

## Prerequisites

- Node.js 18+
- pnpm package manager
- PostgreSQL database

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

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for JWT token generation
- `OAUTH_SERVER_URL`: OAuth server endpoint
- `OWNER_OPEN_ID`: OpenID for the admin user
- `BUILT_IN_FORGE_API_URL`: AI API endpoint
- `BUILT_IN_FORGE_API_KEY`: AI API key
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (required for backend operations)
- `SMTP_USER`: SMTP username for email sending (optional, required for password reset)
- `SMTP_PASS`: SMTP password for email sending (optional, required for password reset)
- `SMTP_FROM`: From email address for password reset emails (optional)
- `SMTP_HOST`: SMTP server host (optional, defaults to Gmail if not set)
- `SMTP_PORT`: SMTP server port (optional, defaults to 465)

4. Initialize the database:

```bash
pnpm db:generate
pnpm db:push
```

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
- `pnpm db:generate` - Generate database migrations
- `pnpm db:push` - Push database schema

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
- `DATABASE_URL` (provided by Render database)
- `JWT_SECRET` (generate a secure random string)
- `OAUTH_SERVER_URL`
- `OWNER_OPEN_ID`
- `BUILT_IN_FORGE_API_URL`
- `BUILT_IN_FORGE_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
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
│   ├── _core/          # Core server utilities
│   └── db.ts           # Database operations
├── drizzle/            # Database schema and migrations
├── shared/             # Shared TypeScript types
├── docs/               # Documentation
└── dist/               # Build output (generated)
```

## Features

- **AI Conversations**: Chat with AI assistant with streaming responses
- **Voice Mode**: Continuous voice interaction with speech recognition
- **File Management**: Upload and manage files
- **Conversation Organization**: Pin, archive, and search conversations
- **User Preferences**: Customize AI behavior and interface settings
- **OAuth Authentication**: Secure user authentication

## Documentation

Detailed documentation is available in the `docs/` directory:

- `ARCHITECTURE.md` - System architecture and design
- `PRODUCT_AUDIT.md` - Feature audit and implementation status
- `ACCESSIBILITY.md` - Accessibility guidelines
- `ACCOUNT_AND_SECURITY.md` - Security considerations
- `VOICE_MODE_ARCHITECTURE.md` - Voice mode implementation details

## License

MIT
