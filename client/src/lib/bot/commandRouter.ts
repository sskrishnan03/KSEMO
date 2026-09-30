import { findWebsite, isDomainName } from "./websiteRegistry";

export type BotIntent =
  | "navigate"
  | "youtube_search"
  | "site_search"
  | "web_search"
  | "chat"
  | "ambiguous"
  | "destructive";

export interface BotAction {
  intent: BotIntent;
  target?: string;
  url?: string;
  query?: string;
  statusText: string;
  openNewTab?: boolean;
  destructive?: boolean;
  feedbackText?: string;
}

/**
 * Normalizes speech input: removes conversational filler words,
 * punctuation, and corrects common speech-to-text misrecognitions.
 */
export function normalizeCommand(raw: string): string {
  let text = raw.trim().toLowerCase();

  // Strip trailing punctuation
  text = text.replace(/[.?!,;:]+$/g, "").trim();

  // Speech recognition common fixes
  text = text
    .replace(/\byou\s+tube\b/g, "youtube")
    .replace(/\bu\s+tube\b/g, "youtube")
    .replace(/\bgit\s+hub\b/g, "github")
    .replace(/\blinked\s+in\b/g, "linkedin")
    .replace(/\bwhats\s+app\b/g, "whatsapp")
    .replace(/\bwhat's\s+app\b/g, "whatsapp")
    .replace(/\bwiki\s+pedia\b/g, "wikipedia")
    .replace(/\bstack\s+overflow\b/g, "stackoverflow");

  // Remove polite/filler prefixes (with optional comma)
  text = text
    .replace(
      /^(can\s+you\s+please|could\s+you\s+please|please|kindly|can\s+you|could\s+you|would\s+you|will\s+you|hey\s+ksemo|ksemo)[, ]+\s*/i,
      ""
    )
    .trim();

  // Remove trailing filler like "please", "for me", "right now"
  text = text
    .replace(/\s+(please|for\s+me|right\s+now)$/i, "")
    .trim();

  return text;
}

/**
 * Extracts the user's original query casing from rawCommand given the normalized query.
 */
function extractOriginalCasing(raw: string, querySnippet: string): string {
  if (!querySnippet) return "";
  const index = raw.toLowerCase().indexOf(querySnippet.toLowerCase());
  if (index !== -1) {
    const rawSnippet = raw.slice(index, index + querySnippet.length).trim();
    // Clean any trailing punctuation
    return rawSnippet.replace(/[.?!,;:]+$/g, "").trim();
  }
  return querySnippet;
}

/**
 * Detects destructive commands that should NEVER execute automatically.
 */
function isDestructiveCommand(text: string): boolean {
  const destructivePatterns = [
    /\bdelete\s+(all|my|everything|account|files)\b/i,
    /\bremove\s+(my\s+account|all|everything)\b/i,
    /\b(erase|wipe|destroy)\s+(all|data|database|account|files)\b/i,
    /\bsend\s+this\s+email\s+to\s+everyone\b/i,
  ];
  return destructivePatterns.some(pattern => pattern.test(text));
}

/**
 * Detects ambiguous commands like "open that", "open it", "go there".
 */
function isAmbiguousCommand(text: string): boolean {
  return /^(open|go\s+to|visit|launch)\s+(it|that|this|there|something)$/i.test(text);
}

/**
 * Main command router for KSEMO Bot.
 * Deterministically analyzes the spoken command to produce a structured action.
 */
export function routeBotCommand(rawCommand: string): BotAction {
  const normalized = normalizeCommand(rawCommand);

  // 1. Destructive safety check
  if (isDestructiveCommand(normalized)) {
    return {
      intent: "destructive",
      statusText: "Action blocked",
      destructive: true,
      feedbackText:
        "I cannot execute destructive actions automatically. Please use the Settings menu to manage your data.",
    };
  }

  // 2. Ambiguous navigation check
  if (isAmbiguousCommand(normalized)) {
    return {
      intent: "ambiguous",
      statusText: "Ambiguous request",
      feedbackText:
        "Which website or link would you like me to open? For example, say \"Open YouTube\" or \"Open GitHub\".",
    };
  }

  // 3. YouTube specific content & play commands
  // Examples:
  // "open youtube and search for believer"
  // "open youtube and play believer"
  // "open youtube and search believer"
  // "search youtube for python tutorials"
  // "find python tutorials on youtube"
  // "play believer on youtube"
  const ytPlayMatch =
    /^(open\s+youtube\s+and\s+(search\s+for|search|play)|search\s+youtube\s+for|search\s+on\s+youtube\s+for|play|find)\s+(.+?)(\s+on\s+youtube)?$/i.exec(
      normalized
    );

  if (
    ytPlayMatch &&
    (normalized.includes("youtube") ||
      normalized.startsWith("search youtube") ||
      normalized.startsWith("open youtube and"))
  ) {
    let querySnippet = ytPlayMatch[3]?.trim() || "";
    // Clean up trailing "on youtube"
    querySnippet = querySnippet.replace(/\s+on\s+youtube$/i, "").trim();

    // If query starts with "play" or "search for"
    querySnippet = querySnippet.replace(/^(search\s+for|search|play)\s+/i, "").trim();

    if (querySnippet) {
      const properQuery = extractOriginalCasing(rawCommand, querySnippet);
      const yt = findWebsite("youtube")!;
      return {
        intent: "youtube_search",
        target: "YouTube",
        query: properQuery,
        url: yt.search!(properQuery),
        statusText: `Searching YouTube...`,
        openNewTab: true,
        feedbackText: `Searching YouTube for "${properQuery}"`,
      };
    }
  }

  // Also check pattern: "find [query] on youtube" or "[query] on youtube"
  const onYtMatch = /^(search\s+for|find|look\s+up|play)\s+(.+?)\s+on\s+youtube$/i.exec(normalized);
  if (onYtMatch) {
    const querySnippet = onYtMatch[2].trim();
    if (querySnippet) {
      const properQuery = extractOriginalCasing(rawCommand, querySnippet);
      const yt = findWebsite("youtube")!;
      return {
        intent: "youtube_search",
        target: "YouTube",
        query: properQuery,
        url: yt.search!(properQuery),
        statusText: `Searching YouTube...`,
        openNewTab: true,
        feedbackText: `Searching YouTube for "${properQuery}"`,
      };
    }
  }

  // 4. Other site specific search commands
  // Examples:
  // "search github for react"
  // "search reddit for tech news"
  // "search wikipedia for albert einstein"
  const siteSearchMatch = /^(search|find|look\s+up)\s+([a-z0-9\s]+?)\s+for\s+(.+)$/i.exec(normalized);
  if (siteSearchMatch) {
    const siteCandidate = siteSearchMatch[2].trim();
    const querySnippet = siteSearchMatch[3].trim();
    const site = findWebsite(siteCandidate);
    if (site && site.search && querySnippet) {
      const properQuery = extractOriginalCasing(rawCommand, querySnippet);
      return {
        intent: "site_search",
        target: site.name,
        query: properQuery,
        url: site.search(properQuery),
        statusText: `Searching ${site.name}...`,
        openNewTab: true,
        feedbackText: `Searching ${site.name} for "${properQuery}"`,
      };
    }
  }

  // 5. Direct navigation commands
  // Verbs: "open", "go to", "visit", "launch", "take me to", "navigate to", "head to"
  const navMatch =
    /^(open|go\s+to|visit|launch|take\s+me\s+to|navigate\s+to|head\s+to)\s+(.+)$/i.exec(
      normalized
    );

  if (navMatch) {
    const destination = navMatch[2].trim();

    // Check if destination is a direct URL or domain
    if (/^https?:\/\//i.test(destination)) {
      return {
        intent: "navigate",
        target: destination,
        url: destination,
        statusText: `Opening ${destination}...`,
        openNewTab: true,
        feedbackText: `Opening ${destination}`,
      };
    }

    if (isDomainName(destination)) {
      const url = `https://${destination}/`;
      return {
        intent: "navigate",
        target: destination,
        url,
        statusText: `Opening ${destination}...`,
        openNewTab: true,
        feedbackText: `Opening ${destination}`,
      };
    }

    // Check against website registry
    const site = findWebsite(destination);
    if (site) {
      return {
        intent: "navigate",
        target: site.name,
        url: site.url,
        statusText: `Opening ${site.name}...`,
        openNewTab: true,
        feedbackText: `Opening ${site.name}`,
      };
    }

    // If destination has a single word without spaces, it could be a domain (e.g. "wikipedia")
    // If not found in registry, resolve safely to https://www.[destination].com
    if (/^[a-z0-9-]+$/i.test(destination)) {
      const targetName = destination.charAt(0).toUpperCase() + destination.slice(1);
      const url = `https://www.${destination.toLowerCase()}.com/`;
      return {
        intent: "navigate",
        target: targetName,
        url,
        statusText: `Opening ${targetName}...`,
        openNewTab: true,
        feedbackText: `Opening ${targetName}`,
      };
    }
  }

  // 6. General Web Search Intent
  // Support:
  // "search the web for..."
  // "search online for..."
  // "find..."
  // "look up..."
  // "search google for..."
  // "search for..."
  // "google..."
  const webSearchPatterns = [
    /^search\s+(the\s+web|online|google)\s+for\s+(.+)$/i,
    /^search\s+for\s+(.+)$/i,
    /^search\s+(.+)$/i,
    /^(look\s+up|find)\s+(.+)$/i,
    /^google\s+(.+)$/i,
  ];

  for (const pattern of webSearchPatterns) {
    const match = pattern.exec(normalized);
    if (match) {
      const querySnippet = match[match.length - 1].trim();
      if (!querySnippet) continue;

      const properQuery = extractOriginalCasing(rawCommand, querySnippet);
      return {
        intent: "web_search",
        query: properQuery,
        statusText: "Searching the web...",
        feedbackText: `Searching the web for "${properQuery}"`,
      };
    }
  }

  // 7. Default: Normal AI Question / Conversational Turn
  return {
    intent: "chat",
    query: rawCommand,
    statusText: "Thinking...",
  };
}
