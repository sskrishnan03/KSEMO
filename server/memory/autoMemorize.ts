import {
  getConversationForUser,
  getMemorySettings,
  listMessagesForConversation,
  saveUserMemoryFacts,
  type MemoryFactToSave,
} from "../supabase-db";
import { extractMemoryCandidates } from "./extract";

// Runs after a chat turn completes. Extracts durable facts from the
// conversation and stores them so future replies can use them. Intentionally
// fire-and-forget: failures are logged and never surface to the chat request.
export async function memorizeConversation(
  userId: number,
  conversationId: string
): Promise<void> {
  try {
    const settings = await getMemorySettings(userId);
    if (!settings?.memoryEnabled) return;

    const conversation = await getConversationForUser(conversationId, userId);
    if (!conversation) return;

    const messages = await listMessagesForConversation(conversationId);
    if (messages.length === 0) return;

    const { candidates } = extractMemoryCandidates(
      [{ id: conversation.id, title: conversation.title, messages }],
      { includeSensitive: true }
    );

    const facts: MemoryFactToSave[] = candidates.map(candidate => ({
      content: candidate.content,
      category: candidate.category,
    }));
    if (facts.length === 0) return;

    await saveUserMemoryFacts(userId, conversationId, facts);
  } catch (error) {
    console.warn("[Memory] auto-memorize failed", error);
  }
}
