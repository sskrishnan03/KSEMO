import "dotenv/config";
import { supabase } from "./supabase-db";

// One-off migration: set every conversation's title to its first user message.
// Mirrors the new createTitle behavior in chatStream.ts (single line, capped at
// the VARCHAR(120) column, no ellipsis). Skips conversations whose title is
// already the first message to avoid needless writes.
//
// Run with: npx tsx server/resetConversationTitles.ts

function toTitle(content: string): string | null {
  const cleaned = content.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length <= 120 ? cleaned : cleaned.slice(0, 120);
}

async function firstUserMessage(conversationId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("messages")
    .select("content")
    .eq("conversation_id", conversationId)
    .eq("role", "user")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.content ?? null;
}

async function main(): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "Missing SUPABASE_SERVICE_ROLE_KEY in .env — cannot run without it."
    );
    process.exit(1);
  }

  let offset = 0;
  const batch = 1000;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (;;) {
    const { data: conversations, error } = await supabase
      .from("conversations")
      .select("id, title")
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .range(offset, offset + batch - 1);
    if (error) throw error;
    if (!conversations?.length) break;

    for (const conversation of conversations) {
      try {
        const raw = await firstUserMessage(conversation.id);
        const title = toTitle(raw ?? "");
        if (!title) {
          skipped++;
          continue;
        }
        if (title === conversation.title) {
          skipped++;
          continue;
        }
        const { error: updateError } = await supabase
          .from("conversations")
          .update({ title })
          .eq("id", conversation.id);
        if (updateError) throw updateError;
        updated++;
      } catch (err) {
        failed++;
        console.warn(
          `[ResetTitles] failed for ${conversation.id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    offset += batch;
  }

  console.log(
    `[ResetTitles] done — ${updated} updated, ${skipped} skipped, ${failed} failed.`
  );
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("[ResetTitles] fatal:", err);
    process.exit(1);
  });