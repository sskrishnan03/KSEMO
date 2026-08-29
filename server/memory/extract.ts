import { MEMORY_CANDIDATES_MAX, type MemoryCategoryId } from "@shared/memory";

// Rule-based extraction of memory candidates from a user's chats.
//
// Important: extraction is ONLY ever run when the user explicitly triggers the
// "Generate from chats" flow and picks the conversations to analyze. Nothing is
// saved automatically — every candidate is returned for review, and only an
// explicit user approval persists anything to the database.

export type MemoryCandidate = {
  title: string;
  content: string;
  category: MemoryCategoryId;
  sensitive: boolean;
  sourceConversationId: string | null;
};

export type ConversationForExtraction = {
  id: string;
  title: string;
  messages: Array<{ role: string; content: string }>;
};

type LinkRule = {
  category: MemoryCategoryId;
  sensitive: boolean;
  markers: RegExp[];
};

// Every marker is case-insensitive: users write "I" or "i", "My" or "my".
const TRAILING_ADVERBS = "(?:really|quite|very|also|just|always|never)\\s+";

// Strong, specific markers. The first matching rule wins, so the most precise
// category (relationship, financial, health, religion, politics) is preferred
// over the generic "remember that ..." capture.
const SPECIFIC_RULES: LinkRule[] = [
  {
    category: "relationship",
    sensitive: true,
    markers: [
      /\bmy\s+(husband|wife|partner|boyfriend|girlfriend|fianc[ée]|spouse|parents?|mother|mom|father|dad|kids?|children|son|daughter|sister|brother|family|grandmother|grandfather|in[-\s]?laws)\b/i,
      /\bmarried\s+to\b/i,
      /\b(?:my|our)\s+wedding\b/i,
    ],
  },
  {
    category: "financial",
    sensitive: true,
    markers: [
      /\bmy\s+(salary|income|pay|wage|rent|mortgage|loan|debt|savings|budget|bank|investments?|retirement|401k|taxes?)\b/i,
      /\bI\s+(?:earn|make|owe|borrowed|lent)\b/i,
      /\b(?:credit|bank|student\s+loan)\s+score\b/i,
      /\bI\s+get\s+paid\b/i,
    ],
  },
  {
    category: "health",
    sensitive: true,
    markers: [
      /\bI(?:\s*'m|\s+am)?\s+(?:allergic|allergy)\b/i,
      /\bI\s+(?:have|suffer\s+from|was\s+diagnosed\s+with|take)\b.*\b(?:diabetes|asthma|anxiety|depression|hypertension|arthritis|migraine|allergy|medication|medicine|condition|disease|cpap|insomnia)\b/i,
      /\bmy\s+(?:blood\s+type|doctor|medication|medicine|therapy)\b/i,
      /\bI\s+am\s+gluten[-\s]?(?:free|intolerant)\b/i,
    ],
  },
  {
    category: "religion",
    sensitive: true,
    markers: [
      /\bI(?:\s*'m|\s+am)\s+(?:a\s+)?(?:muslim|christian|catholic|hindu|jew(?:ish)?|buddhist|sikh|atheist|agnostic|mormon|orthodox|protestant)\b/i,
      /\bmy\s+religion\b/i,
      /\bI\s+(?:go\s+to|attend)\s+(?:church|mosque|temple|synagogue)\b/i,
      /\bI\s+(?:believe\s+in\s+god|pray|fast\s+for\s+ramadan)\b/i,
      /\bmy\s+faith\b/i,
    ],
  },
  {
    category: "politics",
    sensitive: true,
    markers: [
      /\bI(?:\s*'m|\s+am)\s+(?:a\s+)?(?:democrat|republican|liberal|conservative|libertarian|socialist)\b/i,
      /\bmy\s+political\b/i,
      /\bI\s+vote(?:d|r)?\s+for\b/i,
      /\bmy\s+vote\b/i,
    ],
  },
  {
    category: "preference",
    sensitive: false,
    markers: [
      new RegExp(`\\bI\\s+(?:${TRAILING_ADVERBS})*(?:love|like|enjoy|prefer|hate|dislike)\\b`, "i"),
      /\bI(?:\s*'m|\s+am)\s+(?:really|quite|very|not)\s+into\b/i,
      /\b(?:my|our)\s+favo(u)?rite\b/i,
      /\bI\s+don'?t\s+(?:like|care\s+for)\b/i,
    ],
  },
  {
    category: "personal",
    sensitive: false,
    markers: [
      /\bmy\s+name\s+is\b/i,
      /\byou\s+can\s+call\s+me\b/i,
      /\bI\s+was\s+born\s+(?:on|in)\b/i,
      /\bmy\s+(?:birthday|date\s+of\s+birth)\b/i,
      /\bI\s+live\s+in\b/i,
      /\bI\s+work\s+as\b/i,
      /\bmy\s+job\s+is\b/i,
      /\bI\s+moved\s+to\b/i,
      /\bI(?:'m|\s+am)\s+from\b/i,
    ],
  },
];

// Explicit "remember / note this" instructions. These are user-issued commands
// and store whatever follows as a general fact (unless a specific category or
// a sensitive marker wins first).
const GENERAL_RULES: RegExp[] = [
  /\b(?:please\s+)?(?:remember|note|record)\s+that\b/i,
  /\bdon'?t\s+forget\b/i,
  /\bkeep\s+in\s+mind\b/i,
  /\bhere'?s\s+something\s+about\s+me\b/i,
  /\ba\s+(?:good\s+)?thing\s+to\s+know\s+about\s+me\b/i,
  /\bjust\s+(?:fyi|for\s+your\s+information)\b/i,
];

// Used to veto a generic capture that actually contains sensitive information.
const SENSITIVE_MARKERS: RegExp[] = SPECIFIC_RULES.filter(rule => rule.sensitive)
  .flatMap(rule => rule.markers);

function sentence(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function splitSentences(text: string): string[] {
  const parts = text.split(/\n+|(?<=[.!?])\s+/);
  return parts
    .map(part => sentence(part))
    .filter(part => part.length > 0);
}

function titleFor(sentenceText: string): string {
  return sentenceText.length <= 80
    ? sentenceText
    : `${sentenceText.slice(0, 77).trimEnd()}…`;
}

function matchRule(sentenceText: string, rule: LinkRule): boolean {
  return rule.markers.some(marker => marker.test(sentenceText));
}

function matchesSensitiveMarkers(sentenceText: string): boolean {
  return SENSITIVE_MARKERS.some(marker => marker.test(sentenceText));
}

function matchGeneralRule(sentenceText: string): boolean {
  return GENERAL_RULES.some(rule => rule.test(sentenceText));
}

export type ExtractionResult = {
  candidates: MemoryCandidate[];
  // Number of sentences that matched sensitive topics and were skipped because
  // sensitive memory is disabled. Shown to the user so the flow feels
  // transparent rather than silently dropping content.
  blockedSensitive: number;
};

export function extractMemoryCandidates(
  conversations: ConversationForExtraction[],
  opts?: { includeSensitive?: boolean }
): ExtractionResult {
  const includeSensitive = opts?.includeSensitive ?? false;
  const candidates: MemoryCandidate[] = [];
  let blockedSensitive = 0;
  const seen = new Set<string>();

  const tryAdd = (candidate: MemoryCandidate) => {
    const key = candidate.content.toLocaleLowerCase();
    if (seen.has(key)) return;
    if (candidates.length >= MEMORY_CANDIDATES_MAX) return;
    seen.add(key);
    candidates.push(candidate);
  };

  for (const conversation of conversations) {
    for (const message of conversation.messages) {
      if (message.role !== "user") continue;
      for (const rawSentence of splitSentences(message.content)) {
        const text = sentence(rawSentence);
        if (text.length < 2) continue;

        // 1. Specific (non-general) categories first, in priority order.
        const matched = SPECIFIC_RULES.find(rule => matchRule(text, rule));
        if (matched) {
          if (matched.sensitive && !includeSensitive) {
            blockedSensitive += 1;
            continue;
          }
          tryAdd({
            title: titleFor(text),
            content: text,
            category: matched.category,
            sensitive: matched.sensitive,
            sourceConversationId: conversation.id,
          });
          continue;
        }

        // 2. Explicit "remember that ..." instructions.
        if (matchGeneralRule(text)) {
          const containsSensitive = matchesSensitiveMarkers(text);
          if (containsSensitive && !includeSensitive) {
            blockedSensitive += 1;
            continue;
          }
          tryAdd({
            title: titleFor(text),
            content: text,
            category: "general",
            sensitive: containsSensitive,
            sourceConversationId: conversation.id,
          });
          continue;
        }
      }
    }
  }

  return { candidates, blockedSensitive };
}