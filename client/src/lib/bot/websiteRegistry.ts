export interface WebsiteEntry {
  name: string;
  canonicalName: string;
  aliases: string[];
  url: string;
  search?: (query: string) => string;
}

export const POPULAR_WEBSITES: WebsiteEntry[] = [
  {
    name: "YouTube",
    canonicalName: "youtube",
    aliases: ["youtube", "you tube", "yt", "utube"],
    url: "https://www.youtube.com/",
    search: query =>
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
  },
  {
    name: "Google",
    canonicalName: "google",
    aliases: ["google", "google search"],
    url: "https://www.google.com/",
    search: query =>
      `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    name: "Gmail",
    canonicalName: "gmail",
    aliases: ["gmail", "google mail", "email", "mail"],
    url: "https://mail.google.com/",
  },
  {
    name: "GitHub",
    canonicalName: "github",
    aliases: ["github", "git hub", "gh"],
    url: "https://github.com/",
    search: query =>
      `https://github.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    name: "LinkedIn",
    canonicalName: "linkedin",
    aliases: ["linkedin", "linked in"],
    url: "https://www.linkedin.com/",
    search: query =>
      `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(query)}`,
  },
  {
    name: "Instagram",
    canonicalName: "instagram",
    aliases: ["instagram", "insta", "ig"],
    url: "https://www.instagram.com/",
  },
  {
    name: "Reddit",
    canonicalName: "reddit",
    aliases: ["reddit"],
    url: "https://www.reddit.com/",
    search: query =>
      `https://www.reddit.com/search/?q=${encodeURIComponent(query)}`,
  },
  {
    name: "Spotify",
    canonicalName: "spotify",
    aliases: ["spotify"],
    url: "https://open.spotify.com/",
    search: query =>
      `https://open.spotify.com/search/${encodeURIComponent(query)}`,
  },
  {
    name: "Netflix",
    canonicalName: "netflix",
    aliases: ["netflix"],
    url: "https://www.netflix.com/",
    search: query =>
      `https://www.netflix.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    name: "Wikipedia",
    canonicalName: "wikipedia",
    aliases: ["wikipedia", "wiki"],
    url: "https://www.wikipedia.org/",
    search: query =>
      `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}`,
  },
  {
    name: "Amazon",
    canonicalName: "amazon",
    aliases: ["amazon", "amazon store"],
    url: "https://www.amazon.com/",
    search: query =>
      `https://www.amazon.com/s?k=${encodeURIComponent(query)}`,
  },
  {
    name: "Microsoft",
    canonicalName: "microsoft",
    aliases: ["microsoft", "msft"],
    url: "https://www.microsoft.com/",
  },
  {
    name: "Google Maps",
    canonicalName: "maps",
    aliases: ["google maps", "maps", "google map"],
    url: "https://maps.google.com/",
    search: query =>
      `https://maps.google.com/?q=${encodeURIComponent(query)}`,
  },
  {
    name: "Google Drive",
    canonicalName: "drive",
    aliases: ["google drive", "drive", "gdrive"],
    url: "https://drive.google.com/",
  },
  {
    name: "Google Calendar",
    canonicalName: "calendar",
    aliases: ["google calendar", "calendar", "gcal"],
    url: "https://calendar.google.com/",
  },
  {
    name: "Twitter",
    canonicalName: "twitter",
    aliases: ["twitter", "x", "x.com"],
    url: "https://x.com/",
    search: query =>
      `https://x.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    name: "Facebook",
    canonicalName: "facebook",
    aliases: ["facebook", "fb"],
    url: "https://www.facebook.com/",
  },
  {
    name: "WhatsApp",
    canonicalName: "whatsapp",
    aliases: ["whatsapp", "whats app", "whatsapp web"],
    url: "https://web.whatsapp.com/",
  },
  {
    name: "ChatGPT",
    canonicalName: "chatgpt",
    aliases: ["chatgpt", "chat gpt", "openai"],
    url: "https://chatgpt.com/",
  },
  {
    name: "Claude",
    canonicalName: "claude",
    aliases: ["claude", "anthropic"],
    url: "https://claude.ai/",
  },
  {
    name: "Stack Overflow",
    canonicalName: "stackoverflow",
    aliases: ["stackoverflow", "stack overflow"],
    url: "https://stackoverflow.com/",
    search: query =>
      `https://stackoverflow.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    name: "Twitch",
    canonicalName: "twitch",
    aliases: ["twitch", "twitch tv"],
    url: "https://www.twitch.tv/",
    search: query =>
      `https://www.twitch.tv/search?term=${encodeURIComponent(query)}`,
  },
  {
    name: "Notion",
    canonicalName: "notion",
    aliases: ["notion"],
    url: "https://www.notion.so/",
  },
  {
    name: "Pinterest",
    canonicalName: "pinterest",
    aliases: ["pinterest"],
    url: "https://www.pinterest.com/",
  },
  {
    name: "Apple",
    canonicalName: "apple",
    aliases: ["apple"],
    url: "https://www.apple.com/",
  },
  {
    name: "Discord",
    canonicalName: "discord",
    aliases: ["discord"],
    url: "https://discord.com/",
  },
];

/**
 * Finds a website entry matching the requested query or target name.
 */
export function findWebsite(target: string): WebsiteEntry | null {
  const normalized = target.toLowerCase().trim().replace(/['"`]/g, "");
  if (!normalized) return null;

  for (const site of POPULAR_WEBSITES) {
    if (site.canonicalName === normalized) return site;
    if (site.aliases.some(alias => alias === normalized)) return site;
  }

  // Substring match for compound phrases
  for (const site of POPULAR_WEBSITES) {
    if (site.aliases.some(alias => normalized.includes(alias))) return site;
  }

  return null;
}

/**
 * Detects if a string is a domain name like "example.com", "sub.domain.org", etc.
 */
export function isDomainName(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  // Valid domain syntax: something.tld
  return /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(trimmed);
}
