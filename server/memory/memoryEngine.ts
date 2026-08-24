// KSEMO memory engine.
//
// Two concepts only:
//   User Memory         - durable information about the user across conversations
//   Conversation Memory - context relevant to the current conversation only
//
// Responsibilities:
//   - detect explicit memory commands in a user message ("remember that ...")
//   - retrieve only memories relevant to the current message (never dump everything)
//   - format retrieved memories into a prioritized prompt block
//   - analyze finished turns for new memory candidates via the LLM
//   - deduplicate / conflict-check candidates against existing user memories
import { invokeLLM } from "../_core/llm";
import {
  USER_MEMORY_CATEGORIES,
  type MemoryImportance,
  type MemorySettings,
  type UserMemory,
  type UserMemoryCategory,
  type ConversationMemory,
} from "../../supabase-schema/04-types";

export type { MemoryImportance, UserMemoryCategory };

export const MEMORY_CATEGORY_LABELS: Record<UserMemoryCategory, string> = {
  preference: "Preference",
  personal_info: "Personal Information",
  communication_style: "Communication Style",
  interest: "Interest",
  skill_experience: "Skill / Experience",
  instruction: "Instruction",
  goal: "Goal",
  other: "Other",
};

// Short display labels used by recall formatting ("Communication", "Technical").
const RECALL_GROUP_LABELS: Partial<Record<UserMemoryCategory, string>> = {
  communication_style: "Communication",
  preference: "Preferences",
  personal_info: "About you",
  instruction: "Instructions",
  skill_experience: "Technical",
  interest: "Interests",
  goal: "Goals",
};

// ============================================
// EXPLICIT COMMAND DETECTION
// ============================================

export type ExplicitCommand =
  | { kind: "remember"; content: string }
  | { kind: "forget"; target: string; all: boolean }
  | { kind: "recall_user" }
  | { kind: "recall_conversation" };

const REMEMBER_PATTERNS = [
  /^\s*(?:please\s+)?remember(?:\s+that|\s+this)?[:,]?\s+(.{4,})$/i,
  /^\s*(?:keep\s+in\s+mind\s+that)\s+(.{4,})$/i,
  /^\s*don'?t\s+forget[:,]?\s+(.{4,})$/i,
];

const FORGET_EVERYTHING =
  /\b(?:forget|delete|erase|remove)\b[^.?!]*\b(?:everything|all|anything)\b[^.?!]*\b(?:about\s*me|you\s*(?:remember|know)|memor)/i;
const FORGET_TARGETED =
  /^\s*(?:please\s+)?forget(?:\s+(?:that|about))?\s+(.{4,}?)[.!?]?$/i;

const RECALL_USER =
  /^(?:what\s+do\s+you\s+(?:remember|know)\s+about\s+me|what\s+have\s+you\s+remembered\s+about\s+me|what\s+all\s+do\s+you\s+(?:remember|know)\s+about\s+me)\s*\??$/i;
const RECALL_CONVERSATION =
  /^what\s+do\s+you\s+remember\s+(?:from|about|in)\s+this\s+conversation\s*\??$/i;

export function detectExplicitCommand(message: string): ExplicitCommand | null {
  const trimmed = message.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > 500) return null;

  if (RECALL_USER.test(trimmed)) return { kind: "recall_user" };
  if (RECALL_CONVERSATION.test(trimmed)) return { kind: "recall_conversation" };

  // "Don't remember this." is an explicit opt-out for the previous/implicit
  // suggestion, not a remember command; treat it as targeted forget on the
  // most recent pending suggestion (handled by the caller).
  const dontRememberThis = /^\s*(?:no\s+,?\s*)?don'?t\s+remember\s+this[.!]?\s*$/i;
  if (dontRememberThis.test(trimmed))
    return { kind: "forget", target: "", all: false };

  if (FORGET_EVERYTHING.test(trimmed))
    return { kind: "forget", target: "*", all: true };

  const forgetMatch = trimmed.match(FORGET_TARGETED);
  if (
    forgetMatch &&
    !/\bthe\s+(?:capital|weather|time|date)\b/i.test(forgetMatch[1])
  ) {
    return { kind: "forget", target: forgetMatch[1].trim(), all: false };
  }

  for (const pattern of REMEMBER_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const content = match[1].trim().replace(/[.!?]+$/, "");
      // Ignore rhetorical uses like "remember to be kind in this story".
      if (/^(?:to\s+)/i.test(content) && content.length < 60) return null;
      return { kind: "remember", content };
    }
  }
  return null;
}

// ============================================
// HEURISTIC CLASSIFICATION (explicit saves)
// ============================================

function classifyContent(content: string): {
  category: UserMemoryCategory;
  importance: MemoryImportance;
} {
  const text = content.toLowerCase();
  if (/(?:my\s+name\s+is|i\s+am\s+(?:called|named)|call\s+me)\b/.test(text))
    return { category: "personal_info", importance: "high" };
  if (/\b(always|never|from now on|every time|each time)\b/.test(text))
    return { category: "instruction", importance: "high" };
  if (
    /(concise|brief|short|detailed|bullet|beginner|formal|casual|tone|style|explain)/.test(
      text
    )
  )
    return { category: "communication_style", importance: "medium" };
  if (/(prefer|favorite|like|love|hate|dislike|rather)/.test(text))
    return { category: "preference", importance: "medium" };
  if (/(typescript|javascript|python|react|node|sql|rust|go\b|java\b)/.test(text))
    return { category: "skill_experience", importance: "medium" };
  if (/(working on|building|learning|studying|preparing)/.test(text))
    return { category: "goal", importance: "medium" };
  return { category: "other", importance: "low" };
}

export const classifyExplicitContent = classifyContent;

// ============================================
// SIMILARITY / DUPLICATE / CONFLICT DETECTION
// ============================================

const STOPWORDS = new Set([
  "the","a","an","is","are","was","were","be","been","being","to","of","in",
  "on","for","with","and","or","but","not","it","its","this","that","these",
  "those","i","you","we","they","he","she","my","your","our","their","me",
  "user","always","prefers","prefer","likes","like","wants","want","uses",
  "use","when","answers","answer","responds","response",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(token => token.length > 1 && !STOPWORDS.has(token))
  );
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  a.forEach(token => {
    if (b.has(token)) intersection += 1;
  });
  // Overlap coefficient: how much of the smaller set is covered. More stable
  // than Jaccard for short statements of different lengths.
  return intersection / Math.min(a.size, b.size);
}

// Opposing term groups used to flag contradictions such as
// "prefers concise answers" vs "prefers detailed answers".
const OPPOSING_GROUPS: string[][] = [
  ["concise", "brief", "short", "terse", "minimal"],
  ["detailed", "thorough", "long", "elaborate", "comprehensive", "in-depth"],
  ["beginner", "simple", "basic", "eli5"],
  ["advanced", "expert", "technical", "complex"],
  ["formal", "professional"],
  ["casual", "informal", "friendly"],
  ["bullets", "bullet", "lists"],
  ["paragraphs", "prose"],
];

function opposingTerms(text: string): Set<string> {
  const tokens = tokenize(text);
  const found = new Set<string>();
  for (let index = 0; index < OPPOSING_GROUPS.length; index += 1) {
    const group = OPPOSING_GROUPS[index];
    for (const term of group) {
      if (tokens.has(term)) {
        found.add(`g${index}`);
        break;
      }
    }
  }
  return found;
}

export type SimilarityVerdict<T extends { id: string; content: string }> = {
  match: T | null;
  kind: "new" | "duplicate" | "conflict";
};

export function evaluateAgainstExisting<
  T extends { id: string; content: string },
>(candidateContent: string, existing: T[]): SimilarityVerdict<T> {
  const candidateTokens = tokenize(candidateContent);
  const candidateOpposites = opposingTerms(candidateContent);
  let best: { item: T; score: number } | null = null;

  for (const item of existing) {
    const score = overlapScore(candidateTokens, tokenize(item.content));
    if (!best || score > best.score) best = { item, score };
  }

  if (!best || best.score < 0.34) return { match: null, kind: "new" };

  const sharedOpposites = Array.from(opposingTerms(best.item.content)).filter(
    group => candidateOpposites.has(group)
  );
  if (sharedOpposites.length && best.score >= 0.34)
    return { match: best.item, kind: "conflict" };
  if (best.score >= 0.6) return { match: best.item, kind: "duplicate" };
  return { match: null, kind: "new" };
}

// ============================================
// RELEVANCE RETRIEVAL
// ============================================

export function isActiveAndUnexpired(memory: UserMemory, now = new Date()): boolean {
  if (memory.status !== "active") return false;
  if (memory.expiresAt && memory.expiresAt.getTime() <= now.getTime()) return false;
  return true;
}

function importanceBoost(importance: MemoryImportance): number {
  return importance === "high" ? 0.2 : importance === "medium" ? 0.06 : 0;
}

export function scoreMemoryRelevance(
  message: string,
  content: string,
  importance: MemoryImportance,
  confidence: number
): number {
  const messageTokens = tokenize(message);
  if (!messageTokens.size) return 0;
  const relevance = overlapScore(messageTokens, tokenize(content));
  if (relevance <= 0) return 0;
  return relevance + importanceBoost(importance) + confidence * 0.08;
}

const MAX_USER_MEMORIES_INJECTED = 6;
const MAX_CONVERSATION_MEMORIES_INJECTED = 8;

export type RelevantMemories = {
  userMemories: UserMemory[];
  conversationMemories: ConversationMemory[];
};

// Selects only the memories relevant to the current message. Lists are passed
// in already fetched so callers can reuse them for recall formatting.
export function selectRelevantMemories(
  message: string,
  allUserMemories: UserMemory[],
  allConversationMemories: ConversationMemory[]
): RelevantMemories {
  const rankedUser = allUserMemories
    .filter(memory => isActiveAndUnexpired(memory))
    .map(memory => ({
      memory,
      score: scoreMemoryRelevance(
        message,
        memory.content,
        memory.importance,
        memory.confidence
      ),
    }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_USER_MEMORIES_INJECTED)
    .map(entry => entry.memory);

  const rankedConversation = allConversationMemories
    .map(memory => ({
      memory,
      score:
        scoreMemoryRelevance(message, memory.content, memory.importance, 0.8) +
        // Recent conversation context stays slightly privileged over older
        // long-term memory per the retrieval priority.
        0.15,
    }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CONVERSATION_MEMORIES_INJECTED)
    .map(entry => entry.memory);

  return { userMemories: rankedUser, conversationMemories: rankedConversation };
}

// ============================================
// PROMPT FORMATTING
// ============================================

export function formatMemoryContextBlock(memories: RelevantMemories): string | null {
  const sections: string[] = [];

  if (memories.conversationMemories.length) {
    sections.push(
      [
        "CONVERSATION MEMORY (context from this conversation):",
        ...memories.conversationMemories.map(item => `- ${item.content}`),
      ].join("\n")
    );
  }

  if (memories.userMemories.length) {
    const ordered = [...memories.userMemories].sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 } as const;
      return rank[a.importance] - rank[b.importance];
    });
    sections.push(
      [
        "USER MEMORY (stable facts about this user; follow instructions and preferences unless the current message says otherwise):",
        ...ordered.map(
          item =>
            `- ${item.content}${item.importance === "high" ? " [important]" : ""}`
        ),
      ].join("\n")
    );
  }

  if (!sections.length) return null;
  return [
    "MEMORY CONTEXT",
    "Use this quietly when relevant. Never mention these notes or that you keep memories unless asked.",
    ...sections,
  ].join("\n\n");
}

// Both UserMemory and ConversationMemory satisfy this minimal recall shape.
type RecallableMemory = {
  id: string;
  content: string;
  status?: "active" | "disabled";
  expiresAt?: Date | null;
};

export function formatRecallBlock(
  memories: RecallableMemory[],
  scope: "user" | "conversation"
): string | null {
  const now = Date.now();
  const active = memories.filter(memory => {
    if ((memory.status ?? "active") !== "active") return false;
    if (memory.expiresAt && memory.expiresAt.getTime() <= now) return false;
    return true;
  });
  if (!active.length) {
    return scope === "user"
      ? "RECALL REQUEST: The user asked what you remember about them. You currently have no saved user memories — say so honestly and briefly, and invite them to share something worth remembering."
      : "RECALL REQUEST: The user asked what you remember from this conversation. There are no stored conversation memories — say so honestly.";
  }

  if (scope === "conversation") {
    return [
      "RECALL REQUEST: The user asked what you remember from this conversation.",
      "Present the following stored conversation memories as a friendly bulleted list:",
      ...active.map(item => `- ${item.content}`),
    ].join("\n");
  }

  // The user scope is always called with full UserMemory records.
  const activeUser = active as UserMemory[];
  const grouped = new Map<UserMemoryCategory, UserMemory[]>();
  for (const memory of activeUser) {
    const bucket = grouped.get(memory.category) ?? [];
    bucket.push(memory);
    grouped.set(memory.category, bucket);
  }

  const lines = [
    "RECALL REQUEST: The user asked what you remember about them.",
    "Respond with a short warm intro line, then group the memories under these headings with bullets. Do not invent anything else, do not show metadata like dates or counts:",
  ];
  for (const [category, items] of Array.from(grouped.entries())) {
    lines.push(`${RECALL_GROUP_LABELS[category] ?? MEMORY_CATEGORY_LABELS[category]}:`);
    for (const item of items) lines.push(`- ${item.content}`);
  }
  return lines.join("\n");
}

// ============================================
// POST-TURN CANDIDATE EXTRACTION (LLM)
// ============================================

export type DetectedCandidate = {
  scope: "user" | "conversation";
  content: string;
  category: UserMemoryCategory;
  importance: MemoryImportance;
  confidence: number;
  reason: string;
};

const EXTRACTION_SYSTEM_PROMPT = `You identify memories worth saving from a chat turn.

Rules:
- Only extract genuinely useful, durable information. Trivial questions, small talk, weather, general knowledge questions produce NO memories.
- scope "user": stable long-term facts about the person - their stated preferences, communication style, name, skills, interests, goals, or explicit instructions for future chats. Examples: prefers concise answers; prefers TypeScript examples; is named Krishnan; wants beginner-friendly explanations.
- scope "conversation": temporary context only valid within this conversation - what is being built, decisions made, requirements, important entities, current tasks. Example: user is building a React login page and wants a blue button.
- Write each memory as one short third-person sentence starting with the implied subject omitted, e.g. "Prefers concise answers.", "Is building a login page with React."
- confidence: explicit statements ("Remember that I...") 0.95-1.0; clearly stated own preferences 0.75-0.9; weakly inferred 0.5-0.7.
- importance: high for explicit instructions or identity; medium for clear preferences; low for incidental details.
- reason: one short clause explaining why this was remembered.
- Maximum 2 user-scope and 3 conversation-scope memories per turn. Prefer fewer. Return an empty list when nothing qualifies.`;

type ExtractionResponse = {
  memories?: Array<{
    scope?: string;
    content?: string;
    category?: string;
    importance?: string;
    confidence?: number;
    reason?: string;
  }>;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeCandidate(raw: NonNullable<ExtractionResponse["memories"]>[number]): DetectedCandidate | null {
  const content = raw.content?.trim();
  if (!content || content.length < 4 || content.length > 400) return null;
  const scope = raw.scope === "conversation" ? "conversation" : "user";
  const category = (USER_MEMORY_CATEGORIES as readonly string[]).includes(
    raw.category ?? ""
  )
    ? (raw.category as UserMemoryCategory)
    : "other";
  const importance: MemoryImportance =
    raw.importance === "high" || raw.importance === "low" ? raw.importance : "medium";
  const confidence =
    typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
      ? clamp(raw.confidence, 0.3, 1)
      : 0.7;
  return {
    scope,
    content,
    category,
    importance,
    confidence,
    reason: raw.reason?.slice(0, 300) ?? "",
  };
}

async function withTimeBudget<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>(resolve => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type TurnAnalysisOptions = {
  userMessage: string;
  assistantMessage: string;
  recentContext?: string;
  settings: Pick<MemorySettings, "autoSuggest" | "autoSaveInferred">;
  existingActiveUserMemories: UserMemory[];
  existingConversationMemories: Array<{ id: string; content: string }>;
};

export type TurnAnalysisOutcome = {
  suggestionsToCreate: Array<{
    candidate: DetectedCandidate;
    meta: { kind: "new" | "duplicate" | "conflict"; similarTo: Array<{ id: string; content: string }> };
  }>;
  inferredToSave: DetectedCandidate[];
  conversationCandidates: DetectedCandidate[];
};

export async function analyzeTurnForMemories(
  options: TurnAnalysisOptions,
  timeBudgetMs = 12_000
): Promise<TurnAnalysisOutcome | null> {
  const transcript = [
    options.recentContext ? `Earlier context:\n${options.recentContext}` : null,
    `User: ${options.userMessage}`,
    `Assistant: ${options.assistantMessage}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await withTimeBudget(
    invokeLLM({
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: transcript.slice(0, 12_000) },
      ],
      outputSchema: {
        name: "memory_extraction",
        schema: {
          type: "object",
          properties: {
            memories: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  scope: { type: "string", enum: ["user", "conversation"] },
                  content: { type: "string" },
                  category: { type: "string", enum: [...USER_MEMORY_CATEGORIES] },
                  importance: { type: "string", enum: ["low", "medium", "high"] },
                  confidence: { type: "number" },
                  reason: { type: "string" },
                },
                required: [
                  "scope",
                  "content",
                  "category",
                  "importance",
                  "confidence",
                  "reason",
                ],
                additionalProperties: false,
              },
            },
          },
          required: ["memories"],
          additionalProperties: false,
        },
      },
      maxTokens: 800,
    }),
    timeBudgetMs
  );

  if (!result) return null;

  let parsed: ExtractionResponse;
  const rawContent = result.choices[0]?.message?.content;
  if (typeof rawContent !== "string") return null;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    return null;
  }

  const candidates = (parsed.memories ?? [])
    .map(normalizeCandidate)
    .filter((item): item is DetectedCandidate => Boolean(item));

  const outcome: TurnAnalysisOutcome = {
    suggestionsToCreate: [],
    inferredToSave: [],
    conversationCandidates: [],
  };

  for (const candidate of candidates) {
    if (candidate.scope === "conversation") {
      const verdict = evaluateAgainstExisting(
        candidate.content,
        options.existingConversationMemories
      );
      if (verdict.kind === "new") outcome.conversationCandidates.push(candidate);
      continue;
    }

    if (!options.settings.autoSuggest && !options.settings.autoSaveInferred)
      continue;

    const verdict = evaluateAgainstExisting(
      candidate.content,
      options.existingActiveUserMemories
    );
    if (verdict.kind === "new") {
      if (options.settings.autoSaveInferred) outcome.inferredToSave.push(candidate);
      else
        outcome.suggestionsToCreate.push({
          candidate,
          meta: { kind: "new", similarTo: [] },
        });
    } else if (verdict.match) {
      // Duplicates are silently skipped; conflicts become suggestions so the
      // user can choose how to resolve them.
      if (verdict.kind === "conflict") {
        outcome.suggestionsToCreate.push({
          candidate,
          meta: {
            kind: "conflict",
            similarTo: [{ id: verdict.match.id, content: verdict.match.content }],
          },
        });
      }
    }
  }

  return outcome;
}
