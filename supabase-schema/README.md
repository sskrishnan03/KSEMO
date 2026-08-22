# KSEMO Supabase Database Setup

This directory contains the complete database schema and setup scripts for the KSEMO application using Supabase.

## Files Overview

### 1. `01-schema.sql`
Creates all database tables, relationships, indexes, and triggers:
- **users** - User accounts and authentication data
- **user_preferences** - User settings and preferences
- **projects** - User projects for organizing conversations
- **conversations** - Chat conversations with archiving and sharing
- **messages** - Individual messages within conversations
- **message_versions** - Version history for edited messages
- **message_feedback** - User feedback on assistant responses
- **voice_sessions** - Voice interaction sessions
- **files** - File storage metadata
- **attachments** - File attachments to conversations/messages
- **memories** - User memories and facts
- **tasks** - Task management
- **task_activities** - Task activity tracking

### 2. `02-rls-policies.sql`
Row Level Security (RLS) policies to ensure data isolation:
- Users can only access their own data
- Public access to shared conversations
- Service role permissions for authentication
- Comprehensive security rules for all tables

### 3. `03-functions.sql`
Custom database functions for common operations:
- Search functions (full-text search)
- User management functions
- Conversation management (soft delete, restore)
- Feedback management
- Preference upserts
- Utility functions

### 4. `04-types.ts`
TypeScript type definitions matching the database schema:
- Database row types (snake_case)
- Application types (camelCase)
- Helper functions for type conversion
- Insert/update types

### 5. `../server/supabase-db.ts`
Supabase client implementation:
- Replaces in-memory storage with persistent Supabase backend
- Maintains API compatibility with existing code
- Comprehensive error handling
- All database operations implemented

## Installation Instructions

### Step 1: Set up Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and anon/public key

### Step 2: Execute SQL Scripts

In your Supabase dashboard:
1. Go to SQL Editor
2. Execute scripts in order:
   - First: `01-schema.sql`
   - Second: `02-rls-policies.sql`
   - Third: `03-functions.sql`

### Step 3: Configure Environment Variables

Add to your `.env` file:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### Step 4: Install Dependencies

```bash
npm install @supabase/supabase-js
```

### Step 5: Update Code

Replace the in-memory database imports:

In `server/db.ts`:
```typescript
// Old import:
// import * as db from "./db";

// New import:
import * as db from "./supabase-db";
```

Update any router files that import from `../db` to import from `../supabase-db`.

## Database Schema Features

### Security
- Row Level Security (RLS) enabled on all tables
- Users can only access their own data
- Public sharing with share tokens
- Automatic timestamp management

### Performance
- Comprehensive indexing on foreign keys and search fields
- Full-text search with GIN indexes
- Optimized queries with proper joins

### Data Integrity
- Foreign key constraints with proper cascading
- Check constraints for enum values
- Unique constraints where appropriate
- Automatic updated_at timestamps

### Functionality
- Soft delete for conversations
- Message versioning for edit history
- Full-text search across messages, conversations, and memories
- Public conversation sharing
- Comprehensive task management

## Migration Strategy

The implementation maintains API compatibility with the existing in-memory storage:

1. **Functions maintain same signatures** - All existing functions work with Supabase
2. **Type compatibility** - Types match the existing structure
3. **Gradual migration** - Can switch table by table if needed
4. **Fallback support** - Legacy getDb() function still available

## Testing

After setup, test the database connection:

```typescript
import { getUserByOpenId } from "./supabase-db";

const user = await getUserByOpenId("test_open_id");
console.log("Database connection working:", !!user);
```

## Troubleshooting

### Connection Issues
- Verify SUPABASE_URL and SUPABASE_ANON_KEY in .env
- Check Supabase project status
- Ensure RLS policies are correctly configured

### Permission Errors
- Verify RLS policies are enabled
- Check user authentication is working
- Ensure service role key is set for admin operations

### Performance Issues
- Check indexes are created (run `01-schema.sql` again)
- Monitor query performance in Supabase dashboard
- Consider adding more indexes based on usage patterns

## Support

For issues with:
- **Database schema**: Check SQL scripts for syntax errors
- **RLS policies**: Review policy logic in `02-rls-policies.sql`
- **Functions**: Test functions in Supabase SQL Editor
- **TypeScript client**: Check types in `04-types.ts`

## Notes

- This is a complete rewrite from scratch, not using any existing database
- All tables use UUID primary keys except users (uses SERIAL for compatibility)
- Timestamps use TIMESTAMPTZ for timezone awareness
- Full-text search uses PostgreSQL's built-in text search
- RLS policies use auth.uid() for user identification