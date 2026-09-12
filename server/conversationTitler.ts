import { invokeLLM, DEFAULT_LLM_MODEL, type Message as LlmMessage } from "./_core/llm";

export const TITLER_SYSTEM_PROMPT = `You are an expert conversation titler. Your task is to generate a concise, engaging, and highly descriptive title (3 to 5 words max) for the provided chat conversation.
Rules:
1. Capture the core topic or specific intent, not generic phrases (e.g., use "Python Async API Setup" instead of "Coding Help" or "Question About Code").
2. Do NOT use quotation marks, punctuation, labels, or formatting (never write \`Title:\` or \`"Title"\`).
3. Never mention greetings, pleasantries, or meta terms like "Chat", "Help", or "Query".
4. Prioritize the user's ultimate goal or problem over small-talk details.
5. Output plain text only: exactly 3 to 5 words, Title Case.`;

export const TITLER_MODEL = "gemini-flash-lite-latest";
export const TITLER_TEMPERATURE = 0.2;
export const TITLER_MAX_TOKENS = 25;
export const TITLER_TIMEOUT_MS = 4000;

export interface MessageLike {
  role: string;
  content: unknown;
}

/**
 * Prune and format messages for the titler prompt.
 * As recommended:
 * - Pass the first user query and first assistant response (contain ~90% of intent).
 * - If conversation is longer, also append the latest 2 exchanges.
 * - Truncate long message bodies to ~1000 characters to prevent token bloat.
 */
export function formatConversationForTitler(
  messages: MessageLike[],
  fallbackUserPrompt?: string,
  fallbackAssistantResponse?: string
): string {
  const textMessages = messages
    .filter(m => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map(m => ({
      role: m.role === "user" ? "User" : "Assistant",
      content: (m.content as string).replace(/\s+/g, " ").trim().slice(0, 1000),
    }))
    .filter(m => m.content.length > 0);

  if (textMessages.length === 0) {
    const parts: string[] = [];
    if (fallbackUserPrompt?.trim()) {
      parts.push(`User: ${fallbackUserPrompt.trim().slice(0, 1000)}`);
    }
    if (fallbackAssistantResponse?.trim()) {
      parts.push(`Assistant: ${fallbackAssistantResponse.trim().slice(0, 1000)}`);
    }
    return parts.join("\n\n");
  }

  // If 4 or fewer messages, send all of them
  if (textMessages.length <= 4) {
    return textMessages.map(m => `${m.role}: ${m.content}`).join("\n\n");
  }

  // Token pruning for long conversations:
  // First exchange (first user + first assistant) + latest exchange (last 2 messages)
  const firstExchange = textMessages.slice(0, 2);
  const latestExchange = textMessages.slice(-2);

  const selected = [...firstExchange, ...latestExchange];
  return selected.map(m => `${m.role}: ${m.content}`).join("\n\n");
}

const MINOR_WORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "in", "nor", "of", "on", "or", "so", "the", "to", "up", "yet", "with"
]);

/**
 * Capitalizes a string into standard Title Case.
 */
export function toTitleCase(str: string): string {
  const words = str.trim().split(/\s+/).filter(Boolean);
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      // Keep minor words lowercase unless they are the first or last word
      if (index > 0 && index < words.length - 1 && MINOR_WORDS.has(lower)) {
        return lower;
      }
      // Capitalize first character, preserve rest of casing if acronym (e.g. API, SQL, UI)
      if (word.length > 1 && word === word.toUpperCase()) {
        return word;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/**
 * Post-processes and cleans the raw LLM title output according to rules:
 * - 3 to 5 words maximum
 * - Style: Title Case, clean, and punchy
 * - Strips punctuation, quotes, markdown formatting, and labels
 * - Strips filler prefixes like "Question About", "Help With"
 */
export function cleanGeneratedTitle(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;

  // Take first non-empty line
  let cleaned = raw
    .split("\n")
    .map(line => line.trim())
    .find(line => line.length > 0) ?? "";

  if (!cleaned) return null;

  // Strip markdown formatting: bold, italics, backticks, bullet symbols
  cleaned = cleaned.replace(/[*_`#~]/g, "");

  // Strip common label prefixes like "Title:", "Chat:", "Topic:", "Subject:"
  cleaned = cleaned.replace(/^(title|topic|chat|subject|summary)\s*:\s*/i, "");

  // Strip forbidden generic filler phrases at the start
  cleaned = cleaned.replace(
    /^(question about|questions about|discussion on|discussion about|help with|guide to|overview of|query regarding|notes on)\s+/i,
    ""
  );

  // Strip all double quotes, guillemets, and backticks
  cleaned = cleaned.replace(/["“”«»`]/g, "");

  // Repeatedly strip outer single quotes and punctuation
  let prev = "";
  while (prev !== cleaned) {
    prev = cleaned;
    cleaned = cleaned
      .replace(/^['‘’]+|['‘’]+$/g, "")
      .replace(/[.,:;!?]+$/g, "")
      .trim();
  }

  if (!cleaned) return null;

  // Convert to Title Case
  cleaned = toTitleCase(cleaned);

  // Enforce word count: 3 to 5 words (allow 2 words if high quality, cap at 5)
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    return null;
  }

  const cappedWords = words.slice(0, 5);
  const finalTitle = cappedWords.join(" ").slice(0, 120).trim();

  return finalTitle.length > 0 ? finalTitle : null;
}

/**
 * Calls lightweight LLM to generate a concise, engaging conversation title.
 */
export async function generateAiConversationTitle(options: {
  messages?: MessageLike[];
  userPrompt?: string;
  assistantResponse?: string;
  signal?: AbortSignal;
}): Promise<string | null> {
  const conversationText = formatConversationForTitler(
    options.messages ?? [],
    options.userPrompt,
    options.assistantResponse
  );

  if (!conversationText.trim()) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TITLER_TIMEOUT_MS);

  // Chain with parent abort signal if provided
  if (options.signal) {
    options.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const llmMessages: LlmMessage[] = [
      {
        role: "system",
        content: TITLER_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: `Conversation:\n${conversationText}`,
      },
    ];

    const result = await invokeLLM({
      model: TITLER_MODEL || DEFAULT_LLM_MODEL,
      temperature: TITLER_TEMPERATURE,
      maxTokens: TITLER_MAX_TOKENS,
      messages: llmMessages,
      signal: controller.signal,
    });

    const rawChoice = result.choices?.[0]?.message?.content;
    if (typeof rawChoice === "string") {
      const cleaned = cleanGeneratedTitle(rawChoice);
      if (cleaned) return cleaned;
    }
    return null;
  } catch (error) {
    // Timeout or network failure: warn and allow graceful fallback
    if (!controller.signal.aborted) {
      console.warn("[ConversationTitler] AI titling call failed, falling back to heuristic:", error);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Quick title generation for initial conversation creation (before assistant responds).
 */
export function createInitialTitle(content: string): string {
  const cleaned = content.replace(/\s+/g, " ").trim();
  if (!cleaned) return "New conversation";

  if (cleaned.length <= 60) {
    return toTitleCase(cleaned.slice(0, 120));
  }

  const sentences = cleaned.split(/[.!?]/).filter(s => s.trim().length > 0);
  const firstSentence = sentences[0]?.trim() || cleaned;

  if (firstSentence.length > 60) {
    const words = firstSentence.split(/\s+/);
    return toTitleCase(words.slice(0, 8).join(" ").slice(0, 120));
  }

  return toTitleCase(firstSentence.slice(0, 120));
}

/**
 * Deterministic fallback heuristic if the LLM call fails or times out.
 */
export function createFallbackTitle(userContent: string, assistantContent?: string): string {
  const cleanedUser = userContent.replace(/\s+/g, " ").trim();
  if (!cleanedUser) return "New conversation";

  if (cleanedUser.length <= 50) {
    return toTitleCase(cleanedUser.slice(0, 120));
  }

  let topic = extractTopic(cleanedUser);

  if (assistantContent && topic.length > 30) {
    const assistantTopic = extractTopic(assistantContent);
    if (assistantTopic.length < topic.length) {
      topic = assistantTopic;
    }
  }

  if (topic.length > 60) {
    topic = createConciseTitle(topic);
  }

  const result = topic.slice(0, 120) || cleanedUser.slice(0, 60);
  return toTitleCase(result);
}

function extractTopic(content: string): string {
  const fillerPatterns = [
    /^(I need help with|I need|I want|I'm looking for|Can you help me|Please help me|I'm trying to|I am trying to|I would like to|I'd like to|Help me with|I need to|I have a question about|I have questions about)/i,
    /^(So I want|I want to know|I want to understand|I want to learn|I want to figure out)/i,
    /^(What is the best|What are the best|Who is the best|Which is the best)/i,
    /^(How do I|How can I|How to|How should I|How would I)/i,
    /^(Tell me about|Explain|Describe|Discuss|Talk about)/i,
    /^(I'm building|I am building|I'm working on|I am working on|I'm creating|I am creating)/i,
  ];

  let cleaned = content;
  for (const pattern of fillerPatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  const sentences = cleaned.split(/[.!?]/).filter(s => s.trim().length > 0);
  if (sentences.length > 0) {
    cleaned = sentences[0].trim();
  }

  cleaned = cleaned.replace(
    /\s+(and|or|but|because|so|however|therefore|meanwhile|anyway|basically|essentially|just|simply|actually|really|very|quite|rather|somewhat|pretty|fairly)$/i,
    ""
  );

  if (cleaned.length > 60) {
    const words = cleaned.split(/\s+/);
    const meaningfulWords = words.filter(
      word =>
        word.length > 2 &&
        !/^(and|or|but|the|a|an|in|on|at|to|for|of|with|by|from|as|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|must|can|this|that|these|those|it|its|they|them|their|there|here|when|where|why|how|what|which|who|whom|whose)$/i.test(
          word
        )
    );

    if (meaningfulWords.length >= 3) {
      cleaned = meaningfulWords.slice(0, 5).join(" ");
    } else {
      cleaned = words.slice(0, 8).join(" ");
    }
  }

  return cleaned.trim() || content.slice(0, 60);
}

function createConciseTitle(topic: string): string {
  const words = topic.split(/\s+/);
  const questionWords = words.filter(w =>
    /^(what|how|why|when|where|who|which|can|could|should|would|will|do|does|did|is|are|was|were)$/i.test(w)
  );
  const actionWords = words.filter(w =>
    /^(fix|create|build|implement|add|remove|improve|update|change|make|get|find|help|use|set|configure|setup|install|deploy|run|start|stop|test|debug|solve|resolve|handle|manage|optimize|refactor|migrate|convert|transform|generate|parse|process|analyze|validate|verify|check|monitor|track|log|save|load|store|retrieve|fetch|send|receive|connect|disconnect|authenticate|authorize|login|logout|register|signup|sign)$/i.test(
      w
    )
  );
  const subjectWords = words.filter(
    w =>
      w.length > 3 &&
      !/^(and|or|but|the|a|an|in|on|at|to|for|of|with|by|from|as|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|must|can|this|that|these|those|it|its|they|them|their|there|here|when|where|why|how|what|which|who|whom|whose)$/i.test(
        w
      ) &&
      !questionWords.includes(w) &&
      !actionWords.includes(w)
  );

  let concise = "";
  if (actionWords.length > 0 && subjectWords.length > 0) {
    concise = `${actionWords[0]} ${subjectWords.slice(0, 2).join(" ")}`;
  } else if (questionWords.length > 0 && subjectWords.length > 0) {
    concise = `${questionWords[0]} ${subjectWords.slice(0, 2).join(" ")}`;
  } else if (subjectWords.length > 0) {
    concise = subjectWords.slice(0, 3).join(" ");
  } else {
    concise = words.slice(0, 4).join(" ");
  }

  return concise;
}

/**
 * Resolves the final intelligent title: attempts AI title generation first,
 * with deterministic fallback to the regex heuristic if LLM is unavailable or fails.
 */
export async function resolveConversationTitle(options: {
  userContent: string;
  assistantContent: string;
  messages?: MessageLike[];
  signal?: AbortSignal;
}): Promise<string> {
  const aiTitle = await generateAiConversationTitle({
    messages: options.messages,
    userPrompt: options.userContent,
    assistantResponse: options.assistantContent,
    signal: options.signal,
  });

  if (aiTitle) {
    return aiTitle;
  }

  return createFallbackTitle(options.userContent, options.assistantContent);
}
