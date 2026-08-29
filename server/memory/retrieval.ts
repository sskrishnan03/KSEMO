import { MEMORY_RETRIEVAL_LIMIT } from "@shared/memory";
import {
  getMemorySettings,
  listUserMemories,
  type Memory,
} from "../supabase-db";

// Retrieval of the user's saved memories into the AI conversation context.
//
// Rules enforced here (server-side, never trusted to the client):
// - Memory disabled (master toggle off) => nothing is retrieved.
// - Only relevant memories are included (never the full set).
// - Sensitive memories are only eligible when sensitive memory is enabled.
// - Deleted memories are hard-deleted, so they can never be retrieved.

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "being",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "here",
  "hers",
  "him",
  "his",
  "how",
  "i",
  "if",
  "im",
  "in",
  "into",
  "is",
  "it",
  "its",
  "just",
  "may",
  "me",
  "might",
  "more",
  "most",
  "must",
  "my",
  "no",
  "not",
  "of",
  "on",
  "or",
  "our",
  "ours",
  "she",
  "should",
  "so",
  "some",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "to",
  "too",
  "us",
  "very",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "whom",
  "whose",
  "why",
  "will",
  "with",
  "would",
  "you",
  "your",
  "yours",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .map(word => word.replace(/^'+|'+$/g, ""))
    .filter(word => word.length > 1 && !STOPWORDS.has(word));
}

export function scoreMemory(memory: Memory, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;

  const titleTokens = new Set(tokenize(memory.title));
  const contentTokens = new Set(tokenize(memory.content));

  let score = 0;
  for (const token of queryTokens) {
    if (titleTokens.has(token)) score += 2;
    else if (contentTokens.has(token)) score += 1;
  }

  // Exact-substring bonus: the user is quoting or rephrasing a saved fact.
  const needle = memory.content.toLocaleLowerCase();
  if (queryTokens.length >= 2 && needle.includes(queryTokens.join(" "))) {
    score += 3;
  }

  return score;
}

export function retrieveRelevantMemories(
  memories: Memory[],
  query: string,
  limit: number = MEMORY_RETRIEVAL_LIMIT
): Memory[] {
  const queryTokens = tokenize(query);
  return memories
    .map(memory => ({ memory, score: scoreMemory(memory, queryTokens) }))
    .filter(entry => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.memory.updatedAt.getTime() - a.memory.updatedAt.getTime()
    )
    .slice(0, limit)
    .map(entry => entry.memory);
}

// Builds the exact context block injected into the AI system prompt, or null
// when memory is disabled / nothing relevant was found.
export async function buildUserMemoryContext(
  userId: number,
  query: string
): Promise<string | null> {
  const settings = await getMemorySettings(userId);
  if (!settings?.memoryEnabled) return null;

  const allMemories = await listUserMemories(userId);
  const eligible = allMemories.filter(
    memory => !memory.isSensitive || settings.sensitiveMemoryEnabled
  );
  if (eligible.length === 0) return null;

  const relevant = retrieveRelevantMemories(eligible, query);
  if (relevant.length === 0) return null;

  const lines = relevant.map(
    memory => `- ${memory.title}: ${memory.content}`
  );
  const body = [
    "You have the following saved facts about the user. Use them only where they are relevant to the conversation. Never contradict them, and never claim the user mentioned something that is not in these facts.",
    ...lines,
  ].join("\n");

  return body.length > 2_000 ? `${body.slice(0, 1_997)}…` : body;
}