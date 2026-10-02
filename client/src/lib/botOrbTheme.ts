import { useEffect, useState } from "react";

export type BotOrbThemeId =
  | "black-white"
  | "black-cyan"
  | "black-emerald"
  | "black-violet"
  | "black-gold"
  // Legacy aliases
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
  accentHex: string;
  rgb: [number, number, number];
  coreColor: string;
  midColor: string;
  bounceColor: string;
  cloudGradient1: string;
  cloudGradient2: string;
  rollingGradient: string;
}

const THEME_BLACK_WHITE: BotOrbTheme = {
  id: "black-white",
  name: "Black & White",
  combinationLabel: "Black & Pearl White",
  description: "Deep obsidian black infused with swirling luminous pearl white nebula clouds",
  accentHex: "#FFFFFF",
  rgb: [240, 245, 255],
  coreColor: "rgba(240, 245, 255, 0.95)",
  midColor: "rgba(200, 215, 235, 0.5)",
  bounceColor: "rgba(255, 255, 255, 0.35)",
  cloudGradient1:
    "radial-gradient(ellipse 65% 55% at 30% 32%, rgba(240, 245, 255, 0.9) 0%, rgba(200, 215, 235, 0.35) 45%, transparent 72%), radial-gradient(ellipse 55% 50% at 72% 68%, rgba(220, 230, 245, 0.8) 0%, rgba(180, 200, 225, 0.25) 40%, transparent 68%), radial-gradient(circle at 50% 50%, #000000 15%, transparent 65%)",
  cloudGradient2:
    "radial-gradient(circle at 68% 30%, rgba(255, 255, 255, 0.85) 0%, rgba(200, 215, 235, 0.28) 40%, transparent 66%), radial-gradient(circle at 30% 72%, rgba(220, 230, 245, 0.7) 0%, rgba(180, 200, 225, 0.2) 38%, transparent 62%), radial-gradient(circle at 50% 50%, #000000 25%, transparent 70%)",
  rollingGradient:
    "conic-gradient(from 0deg at 50% 50%, #000000 0deg, rgba(60, 65, 75, 0.6) 60deg, #ffffff 120deg, rgba(180, 195, 215, 0.6) 180deg, #000000 270deg, #000000 360deg)",
};

const THEME_BLACK_CYAN: BotOrbTheme = {
  id: "black-cyan",
  name: "Black & Cyan",
  combinationLabel: "Black & Electric Cyan",
  description: "Deep obsidian black infused with swirling electric cyan aurora clouds",
  accentHex: "#00E5FF",
  rgb: [0, 229, 255],
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

const THEME_BLACK_EMERALD: BotOrbTheme = {
  id: "black-emerald",
  name: "Black & Emerald",
  combinationLabel: "Black & Emerald Green",
  description: "Deep obsidian black infused with swirling radiant emerald clouds",
  accentHex: "#10E588",
  rgb: [16, 229, 136],
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

const THEME_BLACK_VIOLET: BotOrbTheme = {
  id: "black-violet",
  name: "Black & Violet",
  combinationLabel: "Black & Cosmic Violet",
  description: "Deep obsidian black infused with swirling cosmic violet nebula clouds",
  accentHex: "#A855F7",
  rgb: [168, 85, 247],
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

const THEME_BLACK_GOLD: BotOrbTheme = {
  id: "black-gold",
  name: "Black & Gold",
  combinationLabel: "Black & Solar Gold",
  description: "Deep obsidian black infused with swirling liquid solar gold stardust clouds",
  accentHex: "#F59E0B",
  rgb: [245, 158, 11],
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
  "black-white": THEME_BLACK_WHITE,
  "black-cyan": THEME_BLACK_CYAN,
  "black-emerald": THEME_BLACK_EMERALD,
  "black-violet": THEME_BLACK_VIOLET,
  "black-gold": THEME_BLACK_GOLD,

  // Legacy mappings for backward compatibility
  "midnight-black": THEME_BLACK_WHITE,
  "eclipse-white": THEME_BLACK_WHITE,
  "electric-cyan": THEME_BLACK_CYAN,
  "cyber-emerald": THEME_BLACK_EMERALD,
  "cosmic-violet": THEME_BLACK_VIOLET,
};

export const BOT_ORB_THEME_LIST: BotOrbTheme[] = [
  THEME_BLACK_WHITE,
  THEME_BLACK_CYAN,
  THEME_BLACK_EMERALD,
  THEME_BLACK_VIOLET,
  THEME_BLACK_GOLD,
];

export const STORAGE_KEY = "ksemo:bot-orb-theme";
export const DEFAULT_BOT_ORB_THEME_ID: BotOrbThemeId = "black-cyan";
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
    boxShadow: `inset 0 1.5px 2px rgba(255, 255, 255, 0.45), inset 0 -3px 6px ${theme.bounceColor}, 0 6px 14px -1px rgba(0, 0, 0, 0.75), 0 0 ${glowSpread}px rgba(${r}, ${g}, ${b}, ${glowAlpha.toFixed(2)})`,
  };
}

export { RealRollingOrb } from "@/components/voice/RealRollingOrb";
