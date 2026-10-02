import { useEffect, useState } from "react";

export type BotOrbThemeId =
  | "arven"
  | "zeno"
  | "veya"
  | "koda"
  | "luma"
  | "orin"
  // Color-based aliases
  | "black-red"
  | "black-cyan"
  | "black-emerald"
  | "black-blue"
  | "black-violet"
  | "black-gold"
  // Legacy aliases
  | "black-white"
  | "midnight-black"
  | "eclipse-white"
  | "electric-cyan"
  | "cyber-emerald"
  | "cosmic-violet";

export interface BotOrbTheme {
  id: BotOrbThemeId;
  name: string;
  combinationLabel: string;
  description: string;
  previewPhrase: string;
  accentHex: string;
  rgb: [number, number, number];
  primaryGl: [number, number, number];
  secondaryGl: [number, number, number];
  accentGl: [number, number, number];
  coreColor: string;
  midColor: string;
  bounceColor: string;
  cloudGradient1: string;
  cloudGradient2: string;
  rollingGradient: string;
}

const THEME_ARVEN: BotOrbTheme = {
  id: "arven",
  name: "Arven",
  combinationLabel: "Crimson Red",
  description: "Deep obsidian black infused with swirling radiant crimson red clouds",
  previewPhrase: "Hey there, I'm Arven! Great to meet you, tell me what's on your mind today.",
  accentHex: "#EF4444",
  rgb: [239, 68, 68],
  primaryGl: [0.95, 0.15, 0.18],
  secondaryGl: [0.45, 0.04, 0.06],
  accentGl: [1.0, 0.38, 0.42],
  coreColor: "rgba(239, 68, 68, 0.95)",
  midColor: "rgba(185, 28, 28, 0.55)",
  bounceColor: "rgba(239, 68, 68, 0.4)",
  cloudGradient1:
    "radial-gradient(ellipse 65% 55% at 30% 32%, rgba(239, 68, 68, 0.9) 0%, rgba(185, 28, 28, 0.35) 45%, transparent 72%), radial-gradient(ellipse 55% 50% at 72% 68%, rgba(220, 38, 38, 0.8) 0%, rgba(153, 27, 27, 0.25) 40%, transparent 68%), radial-gradient(circle at 50% 50%, #000000 15%, transparent 65%)",
  cloudGradient2:
    "radial-gradient(circle at 68% 30%, rgba(239, 68, 68, 0.85) 0%, rgba(185, 28, 28, 0.28) 40%, transparent 66%), radial-gradient(circle at 30% 72%, rgba(220, 38, 38, 0.7) 0%, rgba(153, 27, 27, 0.2) 38%, transparent 62%), radial-gradient(circle at 50% 50%, #000000 25%, transparent 70%)",
  rollingGradient:
    "conic-gradient(from 0deg at 50% 50%, #000000 0deg, rgba(80, 10, 15, 0.6) 50deg, #ef4444 120deg, rgba(180, 20, 30, 0.7) 180deg, #000000 270deg, #000000 360deg)",
};

const THEME_ZENO: BotOrbTheme = {
  id: "zeno",
  name: "Zeno",
  combinationLabel: "Electric Cyan",
  description: "Deep obsidian black infused with swirling electric cyan aurora clouds",
  previewPhrase: "Hi there, I'm Zeno! I'm super excited to chat, let's jump right in!",
  accentHex: "#00E5FF",
  rgb: [0, 229, 255],
  primaryGl: [0.0, 0.85, 1.0],
  secondaryGl: [0.02, 0.26, 0.65],
  accentGl: [0.45, 0.95, 1.0],
  coreColor: "rgba(0, 229, 255, 0.95)",
  midColor: "rgba(0, 140, 255, 0.55)",
  bounceColor: "rgba(0, 229, 255, 0.4)",
  cloudGradient1:
    "radial-gradient(ellipse 65% 55% at 30% 32%, rgba(0, 229, 255, 0.9) 0%, rgba(0, 140, 255, 0.35) 45%, transparent 72%), radial-gradient(ellipse 55% 50% at 72% 68%, rgba(0, 190, 255, 0.8) 0%, rgba(0, 100, 220, 0.25) 40%, transparent 68%), radial-gradient(circle at 50% 50%, #000000 15%, transparent 65%)",
  cloudGradient2:
    "radial-gradient(circle at 68% 30%, rgba(0, 229, 255, 0.85) 0%, rgba(0, 140, 255, 0.28) 40%, transparent 66%), radial-gradient(circle at 30% 72%, rgba(0, 180, 255, 0.7) 0%, rgba(0, 100, 220, 0.2) 38%, transparent 62%), radial-gradient(circle at 50% 50%, #000000 25%, transparent 70%)",
  rollingGradient:
    "conic-gradient(from 0deg at 50% 50%, #000000 0deg, rgba(0, 50, 80, 0.6) 50deg, #00e5ff 120deg, rgba(0, 140, 255, 0.7) 180deg, #000000 270deg, #000000 360deg)",
};

const THEME_VEYA: BotOrbTheme = {
  id: "veya",
  name: "Veya",
  combinationLabel: "Emerald Green",
  description: "Deep obsidian black infused with swirling radiant emerald clouds",
  previewPhrase: "Hi, I'm Veya! It's so nice to meet you, what would you like to talk about?",
  accentHex: "#10E588",
  rgb: [16, 229, 136],
  primaryGl: [0.06, 0.92, 0.54],
  secondaryGl: [0.015, 0.42, 0.28],
  accentGl: [0.38, 1.0, 0.78],
  coreColor: "rgba(16, 229, 136, 0.95)",
  midColor: "rgba(5, 175, 100, 0.55)",
  bounceColor: "rgba(16, 229, 136, 0.4)",
  cloudGradient1:
    "radial-gradient(ellipse 65% 55% at 30% 32%, rgba(16, 229, 136, 0.9) 0%, rgba(5, 175, 100, 0.35) 45%, transparent 72%), radial-gradient(ellipse 55% 50% at 72% 68%, rgba(10, 210, 120, 0.8) 0%, rgba(5, 140, 80, 0.25) 40%, transparent 68%), radial-gradient(circle at 50% 50%, #000000 15%, transparent 65%)",
  cloudGradient2:
    "radial-gradient(circle at 68% 30%, rgba(16, 229, 136, 0.85) 0%, rgba(5, 175, 100, 0.28) 40%, transparent 66%), radial-gradient(circle at 30% 72%, rgba(10, 200, 115, 0.7) 0%, rgba(5, 130, 75, 0.2) 38%, transparent 62%), radial-gradient(circle at 50% 50%, #000000 25%, transparent 70%)",
  rollingGradient:
    "conic-gradient(from 0deg at 50% 50%, #000000 0deg, rgba(5, 45, 25, 0.6) 50deg, #10e588 120deg, rgba(5, 160, 90, 0.7) 180deg, #000000 270deg, #000000 360deg)",
};

const THEME_KODA: BotOrbTheme = {
  id: "koda",
  name: "Koda",
  combinationLabel: "Sapphire Blue",
  description: "Deep obsidian black infused with swirling luminous sapphire blue cosmic clouds",
  previewPhrase: "Hey, I'm Koda! Always happy to hang out and help you with anything today.",
  accentHex: "#2563EB",
  rgb: [37, 99, 235],
  primaryGl: [0.15, 0.42, 0.98],
  secondaryGl: [0.04, 0.12, 0.52],
  accentGl: [0.45, 0.72, 1.0],
  coreColor: "rgba(37, 99, 235, 0.95)",
  midColor: "rgba(29, 78, 216, 0.55)",
  bounceColor: "rgba(37, 99, 235, 0.4)",
  cloudGradient1:
    "radial-gradient(ellipse 65% 55% at 30% 32%, rgba(37, 99, 235, 0.9) 0%, rgba(29, 78, 216, 0.35) 45%, transparent 72%), radial-gradient(ellipse 55% 50% at 72% 68%, rgba(59, 130, 246, 0.8) 0%, rgba(30, 64, 175, 0.25) 40%, transparent 68%), radial-gradient(circle at 50% 50%, #000000 15%, transparent 65%)",
  cloudGradient2:
    "radial-gradient(circle at 68% 30%, rgba(37, 99, 235, 0.85) 0%, rgba(29, 78, 216, 0.28) 40%, transparent 66%), radial-gradient(circle at 30% 72%, rgba(59, 130, 246, 0.7) 0%, rgba(30, 64, 175, 0.2) 38%, transparent 62%), radial-gradient(circle at 50% 50%, #000000 25%, transparent 70%)",
  rollingGradient:
    "conic-gradient(from 0deg at 50% 50%, #000000 0deg, rgba(10, 30, 80, 0.6) 50deg, #2563eb 120deg, rgba(30, 64, 175, 0.7) 180deg, #000000 270deg, #000000 360deg)",
};

const THEME_LUMA: BotOrbTheme = {
  id: "luma",
  name: "Luma",
  combinationLabel: "Cosmic Violet",
  description: "Deep obsidian black infused with swirling cosmic violet nebula clouds",
  previewPhrase: "Hi there, I'm Luma! I'm so excited to see what fun ideas we come up with.",
  accentHex: "#A855F7",
  rgb: [168, 85, 247],
  primaryGl: [0.66, 0.33, 0.97],
  secondaryGl: [0.22, 0.08, 0.48],
  accentGl: [0.88, 0.58, 1.0],
  coreColor: "rgba(168, 85, 247, 0.95)",
  midColor: "rgba(125, 45, 230, 0.55)",
  bounceColor: "rgba(168, 85, 247, 0.4)",
  cloudGradient1:
    "radial-gradient(ellipse 65% 55% at 30% 32%, rgba(168, 85, 247, 0.9) 0%, rgba(125, 45, 230, 0.35) 45%, transparent 72%), radial-gradient(ellipse 55% 50% at 72% 68%, rgba(145, 65, 235, 0.8) 0%, rgba(100, 30, 200, 0.25) 40%, transparent 68%), radial-gradient(circle at 50% 50%, #000000 15%, transparent 65%)",
  cloudGradient2:
    "radial-gradient(circle at 68% 30%, rgba(168, 85, 247, 0.85) 0%, rgba(125, 45, 230, 0.28) 40%, transparent 66%), radial-gradient(circle at 30% 72%, rgba(140, 55, 225, 0.7) 0%, rgba(90, 25, 185, 0.2) 38%, transparent 62%), radial-gradient(circle at 50% 50%, #000000 25%, transparent 70%)",
  rollingGradient:
    "conic-gradient(from 0deg at 50% 50%, #000000 0deg, rgba(45, 15, 75, 0.6) 50deg, #a855f7 120deg, rgba(120, 40, 220, 0.7) 180deg, #000000 270deg, #000000 360deg)",
};

const THEME_ORIN: BotOrbTheme = {
  id: "orin",
  name: "Orin",
  combinationLabel: "Solar Gold",
  description: "Deep obsidian black infused with swirling liquid solar gold stardust clouds",
  previewPhrase: "Hello there, I'm Orin! Wishing you a wonderful day, what shall we chat about?",
  accentHex: "#F59E0B",
  rgb: [245, 158, 11],
  primaryGl: [0.96, 0.62, 0.04],
  secondaryGl: [0.55, 0.28, 0.02],
  accentGl: [1.0, 0.88, 0.48],
  coreColor: "rgba(245, 158, 11, 0.95)",
  midColor: "rgba(217, 119, 6, 0.55)",
  bounceColor: "rgba(245, 158, 11, 0.4)",
  cloudGradient1:
    "radial-gradient(ellipse 65% 55% at 30% 32%, rgba(245, 158, 11, 0.9) 0%, rgba(217, 119, 6, 0.35) 45%, transparent 72%), radial-gradient(ellipse 55% 50% at 72% 68%, rgba(251, 191, 36, 0.8) 0%, rgba(180, 83, 9, 0.25) 40%, transparent 68%), radial-gradient(circle at 50% 50%, #000000 15%, transparent 65%)",
  cloudGradient2:
    "radial-gradient(circle at 68% 30%, rgba(245, 158, 11, 0.85) 0%, rgba(217, 119, 6, 0.28) 40%, transparent 66%), radial-gradient(circle at 30% 72%, rgba(251, 191, 36, 0.7) 0%, rgba(180, 83, 9, 0.2) 38%, transparent 62%), radial-gradient(circle at 50% 50%, #000000 25%, transparent 70%)",
  rollingGradient:
    "conic-gradient(from 0deg at 50% 50%, #000000 0deg, rgba(80, 50, 10, 0.6) 50deg, #f59e0b 120deg, rgba(217, 119, 6, 0.7) 180deg, #000000 270deg, #000000 360deg)",
};

export const BOT_ORB_THEMES: Record<BotOrbThemeId, BotOrbTheme> = {
  "arven": THEME_ARVEN,
  "zeno": THEME_ZENO,
  "veya": THEME_VEYA,
  "koda": THEME_KODA,
  "luma": THEME_LUMA,
  "orin": THEME_ORIN,

  // Color-based aliases
  "black-red": THEME_ARVEN,
  "black-cyan": THEME_ZENO,
  "black-emerald": THEME_VEYA,
  "black-blue": THEME_KODA,
  "black-violet": THEME_LUMA,
  "black-gold": THEME_ORIN,

  // Legacy mappings for backward compatibility
  "black-white": THEME_ARVEN,
  "midnight-black": THEME_VEYA,
  "eclipse-white": THEME_ARVEN,
  "electric-cyan": THEME_ZENO,
  "cyber-emerald": THEME_VEYA,
  "cosmic-violet": THEME_LUMA,
};

export const BOT_ORB_THEME_LIST: BotOrbTheme[] = [
  THEME_ARVEN,
  THEME_ZENO,
  THEME_VEYA,
  THEME_KODA,
  THEME_LUMA,
  THEME_ORIN,
];

export const STORAGE_KEY = "ksemo:bot-orb-theme";
export const DEFAULT_BOT_ORB_THEME_ID: BotOrbThemeId = "veya";
const EVENT_NAME = "ksemo:bot-orb-theme-change";

export function getStoredBotOrbThemeId(): BotOrbThemeId {
  if (typeof window === "undefined" || !("localStorage" in window)) {
    return DEFAULT_BOT_ORB_THEME_ID;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && raw in BOT_ORB_THEMES) {
      return raw as BotOrbThemeId;
    }
  } catch {
    // LocalStorage unavailable
  }
  return DEFAULT_BOT_ORB_THEME_ID;
}

export function setStoredBotOrbThemeId(themeId: BotOrbThemeId): void {
  if (typeof window === "undefined") return;
  try {
    if ("localStorage" in window) {
      window.localStorage.setItem(STORAGE_KEY, themeId);
    }
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, { detail: { themeId } })
    );
  } catch {
    // Ignore storage issues
  }
}

/**
 * Hook to read and update the current Bot Voice Orb theme.
 * Keeps all components (Settings Dialog, Chat Composer, etc.) synchronized in real time.
 */
export function useBotOrbTheme() {
  const [themeId, setThemeIdState] = useState<BotOrbThemeId>(() =>
    getStoredBotOrbThemeId()
  );

  useEffect(() => {
    const onCustomEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ themeId: BotOrbThemeId }>).detail;
      if (detail?.themeId && detail.themeId in BOT_ORB_THEMES) {
        setThemeIdState(detail.themeId);
      }
    };

    const onStorageEvent = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue && e.newValue in BOT_ORB_THEMES) {
        setThemeIdState(e.newValue as BotOrbThemeId);
      }
    };

    window.addEventListener(EVENT_NAME, onCustomEvent);
    window.addEventListener("storage", onStorageEvent);

    return () => {
      window.removeEventListener(EVENT_NAME, onCustomEvent);
      window.removeEventListener("storage", onStorageEvent);
    };
  }, []);

  const setTheme = (nextThemeId: BotOrbThemeId) => {
    setThemeIdState(nextThemeId);
    setStoredBotOrbThemeId(nextThemeId);
  };

  const currentTheme = BOT_ORB_THEMES[themeId] || BOT_ORB_THEMES[DEFAULT_BOT_ORB_THEME_ID];

  return {
    themeId,
    theme: currentTheme,
    setTheme,
    themes: BOT_ORB_THEME_LIST,
  };
}

/**
 * Builds the CSS style properties for the 3D realistic sphere representation of an orb theme.
 */
export function getSphereStyle(theme: BotOrbTheme, customGlow?: { spread: number; alpha: number }) {
  const [r, g, b] = theme.rgb;
  const glowSpread = customGlow ? customGlow.spread : 10;
  const glowAlpha = customGlow ? customGlow.alpha : 0.28;

  return {
    background: "#000000",
    boxShadow: `inset 0 -3px 6px ${theme.bounceColor}, 0 6px 14px -1px rgba(0, 0, 0, 0.75), 0 0 ${glowSpread}px rgba(${r}, ${g}, ${b}, ${glowAlpha.toFixed(2)})`,
  };
}

export { RealRollingOrb } from "@/components/voice/RealRollingOrb";
