# KSEMO Database Migration Guide

This guide helps you migrate from the in-memory database to the Supabase database implementation.

## Overview

The migration replaces the in-memory storage system in `server/db.ts` with a persistent Supabase backend while maintaining API compatibility.

## Prerequisites

1. ✅ Supabase project created
2. ✅ Database schema executed (01-schema.sql, 02-rls-policies.sql, 03-functions.sql)
3. ✅ @supabase/supabase-js package installed
4. ✅ Environment variables configured

## Migration Steps

### Step 1: Update Environment Variables

Add these to your `.env` file:
```env
SUPABASE_URL=https://vauqtdjpjwlhfgixfrij.supabase.co
SUPABASE_ANON_KEY=sb_publishable_wCv3g2jSb_qMbR7I3Fifbg_obIw1iuq
```

### Step 2: Update Router Imports

Find and replace these imports in router files:

**In `server/routers/ksemo.ts`:**
```typescript
// Old:
import {
  createConversationForUser,
  createMessage,
  // ... other imports
} from "../db";

// New:
import {
  createConversationForUser,
  createMessage,
  // ... other imports
} from "../supabase-db";
```

**In `server/routers/authCredentials.ts`:**
```typescript
// Old:
import * as db from "../db";

// New:
import * as db from "../supabase-db";
```

**In `server/routers/product.ts`:**
```typescript
// Old:
import { getDb } from "../db";

// New:
import { getDb } from "../supabase-db";
```

### Step 3: Type Updates

The new database uses slightly different field names (snake_case in database, camelCase in application). The conversion functions handle this automatically, but you may need to update type references:

```typescript
// Old types from server/db.ts are still compatible
// New types are in supabase-schema/04-types.ts

// If you need specific types, import from:
import type { User, Conversation, Message } from "../supabase-schema/04-types";
```

### Step 4: Test the Migration

1. Start your development server:
```bash
npm run dev
```

2. Test basic operations:
- User registration/login
- Create a conversation
- Send a message
- Check user preferences

### Step 5: Verify Data Persistence

1. Create some test data
2. Restart the server
3. Verify data still exists (should persist with Supabase)

## Compatibility Notes

### Field Name Changes

The database uses snake_case, but the TypeScript client automatically converts:

| Database Field | Application Field |
|---------------|-------------------|
| `open_id` | `open_id` |
| `user_id` | `user_id` |
| `conversation_type` | `conversation_type` |
| `is_pinned` | `is_pinned` |
| `created_at` | `created_at` |
| `updated_at` | `updated_at` |

### Function Signatures

All function signatures remain identical to ensure compatibility:

```typescript
// These work exactly the same
await upsertUser(user);
await createConversationForUser(input);
await listConversationsForUser(userId, scope);
```

### New Features Available

With Supabase, you now have:
- **Persistent storage** - Data survives server restarts
- **Full-text search** - Better search performance
- **Public sharing** - Share conversations via tokens
- **Row Level Security** - Built-in data protection
- **Scalability** - Handle more users and data

## Rollback Plan

If you need to rollback to in-memory storage:

1. Revert the import changes:
```typescript
// Change back to:
import * as db from "../db";
```

2. Remove Supabase environment variables (optional)

3. Restart the server

## Troubleshooting

### Connection Errors

**Error:** "Database connection failed"
**Solution:** 
- Verify SUPABASE_URL and SUPABASE_ANON_KEY are correct
- Check your Supabase project is active
- Ensure RLS policies are properly configured

### Permission Errors

**Error:** "Permission denied" or RLS errors
**Solution:**
- Verify user authentication is working
- Check RLS policies in Supabase dashboard
- Ensure service role key is set for admin operations

### Type Errors

**Error:** TypeScript type mismatches
**Solution:**
- Import types from `supabase-schema/04-types.ts`
- Use conversion functions: `dbToUser()`, `dbToConversation()`, etc.
- Check that field names match the new schema

### Data Not Persisting

**Error:** Data disappears after restart
**Solution:**
- Verify you're using the Supabase client, not in-memory
- Check that imports point to `supabase-db.ts`
- Test database connection directly in Supabase dashboard

## Performance Considerations

The Supabase implementation includes:

1. **Optimized indexes** on frequently queried fields
2. **Full-text search** with GIN indexes
3. **Connection pooling** via Supabase
4. **Automatic caching** in Supabase infrastructure

Monitor performance in your Supabase dashboard and add indexes as needed based on usage patterns.

## Next Steps

After successful migration:

1. **Set up backups** - Configure Supabase backups
2. **Monitor usage** - Check Supabase dashboard for metrics
3. **Optimize queries** - Add custom indexes based on real usage
4. **Set up logging** - Enable Supabase logging for debugging
5. **Configure webhooks** - If needed for real-time features

## Support

For issues:
1. Check the Supabase dashboard logs
2. Review the SQL scripts for any execution errors
3. Test functions directly in Supabase SQL Editor
4. Consult the main README.md in this directory

## Advanced Configuration

### Custom Functions

You can add custom functions in `03-functions.sql` and call them via:

```typescript
const { data, error } = await supabase.rpc('your_function', {
  param1: value1,
  param2: value2
});
```

### Real-time Subscriptions

Supabase supports real-time updates:

```typescript
const subscription = supabase
  .channel('conversations')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, payload => {
    console.log('New conversation:', payload);
  })
  .subscribe();
```

### Storage Integration

For file storage, Supabase provides built-in storage buckets. You can integrate this with the existing `files` table for better file management.