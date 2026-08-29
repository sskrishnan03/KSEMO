// Memory system shared constants. Used by both the server (schema validation,
// extraction, retrieval) and the client (Settings UI) so categories and caps
// never drift.

export const MEMORY_CATEGORIES = [
  {
    id: "general",
    label: "General",
    description: "General facts and notes about you.",
    sensitive: false,
  },
  {
    id: "preference",
    label: "Preferences",
    description: "Likes, dislikes, and personal preferences.",
    sensitive: false,
  },
  {
    id: "personal",
    label: "Personal",
    description: "Personal details such as your name and birthday.",
    sensitive: false,
  },
  {
    id: "health",
    label: "Health",
    description: "Health conditions, allergies, and medications.",
    sensitive: true,
  },
  {
    id: "religion",
    label: "Religion",
    description: "Religious beliefs and practices.",
    sensitive: true,
  },
  {
    id: "politics",
    label: "Politics",
    description: "Political views and opinions.",
    sensitive: true,
  },
  {
    id: "financial",
    label: "Financial",
    description: "Income, debts, and financial details.",
    sensitive: true,
  },
  {
    id: "relationship",
    label: "Relationship",
    description: "Relationships and family details.",
    sensitive: true,
  },
] as const;

export type MemoryCategoryId = (typeof MEMORY_CATEGORIES)[number]["id"];

export const SENSITIVE_MEMORY_CATEGORIES: ReadonlySet<MemoryCategoryId> =
  new Set(
    MEMORY_CATEGORIES.filter(category => category.sensitive).map(
      category => category.id
    )
  );

export const isMemoryCategory = (
  category: string
): category is MemoryCategoryId =>
  MEMORY_CATEGORIES.some(cat => cat.id === category);

export const isSensitiveMemoryCategory = (category: string): boolean =>
  SENSITIVE_MEMORY_CATEGORIES.has(category as MemoryCategoryId);

export const memoryCategoryLabel = (category: string): string =>
  MEMORY_CATEGORIES.find(cat => cat.id === category)?.label ?? "General";

export const memoryCategorySensitive = (category: string): boolean =>
  MEMORY_CATEGORIES.find(cat => cat.id === category)?.sensitive ?? false;

export const MEMORY_SOURCES = ["manual", "chat"] as const;
export type MemorySource = (typeof MEMORY_SOURCES)[number];

export const MEMORY_CONSENT_STATUSES = ["explicit", "silent"] as const;
export type MemoryConsentStatus = (typeof MEMORY_CONSENT_STATUSES)[number];

export const MEMORY_TITLE_MAX = 160;
export const MEMORY_CONTENT_MAX = 4_000;
export const MEMORY_CANDIDATES_MAX = 40;
export const MEMORY_RETRIEVAL_LIMIT = 5;