import { useEffect, useState } from "react";

export type BotOrbThemeId = string;

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

/** One fixed KSEMO orb: near-black glass with a restrained graphite sheen. */
export const KSEMO_ORB_THEME: BotOrbTheme = {
  id: "ksemo",
  name: "KSEMO",
  combinationLabel: "Obsidian",
  description: "A near-black glass sphere with a subtle graphite edge light.",
  previewPhrase: "Hello, I’m KSEMO. What can I help you with?",
  accentHex: "#747474",
  rgb: [88, 88, 88],
  primaryGl: [0.075, 0.075, 0.075],
  secondaryGl: [0.018, 0.018, 0.018],
  accentGl: [0.24, 0.24, 0.24],
  coreColor: "rgba(38, 38, 38, 0.96)",
  midColor: "rgba(16, 16, 16, 0.62)",
  bounceColor: "rgba(70, 70, 70, 0.42)",
  cloudGradient1:
    "radial-gradient(ellipse 68% 54% at 28% 30%, rgba(95, 95, 95, 0.42) 0%, rgba(35, 35, 35, 0.22) 44%, transparent 72%), radial-gradient(ellipse 58% 52% at 72% 68%, rgba(50, 50, 50, 0.3) 0%, rgba(12, 12, 12, 0.18) 42%, transparent 70%), radial-gradient(circle at 50% 50%, #020202 18%, transparent 68%)",
  cloudGradient2:
    "radial-gradient(circle at 68% 28%, rgba(110, 110, 110, 0.42) 0%, rgba(42, 42, 42, 0.22) 42%, transparent 68%), radial-gradient(circle at 30% 74%, rgba(48, 48, 48, 0.3) 0%, rgba(10, 10, 10, 0.2) 40%, transparent 66%), radial-gradient(circle at 50% 50%, #020202 24%, transparent 70%)",
  rollingGradient:
    "conic-gradient(from 0deg at 50% 50%, #020202 0deg, rgba(28, 28, 28, 0.72) 48deg, #505050 112deg, rgba(22, 22, 22, 0.82) 184deg, #020202 278deg, #020202 360deg)",
};

export const BOT_ORB_THEMES: Record<string, BotOrbTheme> = {
  ksemo: KSEMO_ORB_THEME,
};

export const BOT_ORB_THEME_LIST: BotOrbTheme[] = [KSEMO_ORB_THEME];
export const STORAGE_KEY = "ksemo:bot-orb-theme";
export const DEFAULT_BOT_ORB_THEME_ID: BotOrbThemeId = "ksemo";
const EVENT_NAME = "ksemo:bot-orb-theme-change";

export function getStoredBotOrbThemeId(): BotOrbThemeId {
  return DEFAULT_BOT_ORB_THEME_ID;
}

/** Legacy setter clears old selections; there is only one KSEMO orb now. */
export function setStoredBotOrbThemeId(_themeId: BotOrbThemeId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.removeItem(STORAGE_KEY);
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, { detail: { themeId: DEFAULT_BOT_ORB_THEME_ID } })
    );
  } catch {
    // Ignore storage issues.
  }
}

/** Compatibility hook for callers that still read a saved orb preference. */
export function useBotOrbTheme() {
  const [themeId, setThemeId] = useState<BotOrbThemeId>(DEFAULT_BOT_ORB_THEME_ID);
  useEffect(() => {
    const migrate = () => setThemeId(DEFAULT_BOT_ORB_THEME_ID);
    migrate();
    window.addEventListener(EVENT_NAME, migrate);
    window.addEventListener("storage", migrate);
    return () => {
      window.removeEventListener(EVENT_NAME, migrate);
      window.removeEventListener("storage", migrate);
    };
  }, []);
  return {
    themeId,
    theme: KSEMO_ORB_THEME,
    setTheme: setStoredBotOrbThemeId,
    themes: BOT_ORB_THEME_LIST,
  };
}

export function getSphereStyle(
  theme: BotOrbTheme,
  customGlow?: { spread: number; alpha: number }
) {
  const [r, g, b] = theme.rgb;
  const glowSpread = customGlow?.spread ?? 12;
  const glowAlpha = customGlow?.alpha ?? 0.34;
  return {
    background: "#020611",
    boxShadow: `inset 0 -3px 8px ${theme.bounceColor}, 0 8px 18px -2px rgba(0, 0, 0, 0.62), 0 0 ${glowSpread}px rgba(${r}, ${g}, ${b}, ${glowAlpha.toFixed(2)})`,
  };
}
