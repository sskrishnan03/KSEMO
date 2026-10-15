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

/** One fixed KSEMO orb: a luminous cyan/blue aurora with a pearl-white core. */
export const KSEMO_ORB_THEME: BotOrbTheme = {
  id: "ksemo",
  name: "KSEMO",
  combinationLabel: "Prismatic Aurora",
  description: "A deep-space sphere with flowing cyan, sapphire, and pearl light.",
  previewPhrase: "Hello, I’m KSEMO. What can I help you with?",
  accentHex: "#C8F7FF",
  rgb: [73, 202, 255],
  primaryGl: [0.06, 0.58, 0.95],
  secondaryGl: [0.12, 0.12, 0.52],
  accentGl: [0.72, 0.96, 1.0],
  coreColor: "rgba(70, 198, 255, 0.96)",
  midColor: "rgba(42, 62, 190, 0.62)",
  bounceColor: "rgba(95, 222, 255, 0.52)",
  cloudGradient1:
    "radial-gradient(ellipse 68% 54% at 28% 30%, rgba(80, 220, 255, 0.92) 0%, rgba(28, 112, 230, 0.38) 44%, transparent 72%), radial-gradient(ellipse 58% 52% at 72% 68%, rgba(95, 100, 255, 0.78) 0%, rgba(35, 55, 180, 0.3) 42%, transparent 70%), radial-gradient(circle at 50% 50%, #020611 18%, transparent 68%)",
  cloudGradient2:
    "radial-gradient(circle at 68% 28%, rgba(128, 244, 255, 0.86) 0%, rgba(36, 126, 244, 0.34) 42%, transparent 68%), radial-gradient(circle at 30% 74%, rgba(112, 110, 255, 0.76) 0%, rgba(42, 54, 174, 0.28) 40%, transparent 66%), radial-gradient(circle at 50% 50%, #020611 24%, transparent 70%)",
  rollingGradient:
    "conic-gradient(from 0deg at 50% 50%, #020611 0deg, rgba(15, 76, 150, 0.72) 48deg, #62e5ff 112deg, rgba(99, 94, 255, 0.82) 184deg, #020611 278deg, #020611 360deg)",
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
