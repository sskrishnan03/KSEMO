import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  BOT_ORB_THEME_LIST,
  BOT_ORB_THEMES,
  DEFAULT_BOT_ORB_THEME_ID,
  getSphereStyle,
  getStoredBotOrbThemeId,
  setStoredBotOrbThemeId,
  STORAGE_KEY,
} from "./botOrbTheme";

describe("botOrbTheme", () => {
  it("contains exactly 6 distinct black and color combinations", () => {
    expect(BOT_ORB_THEME_LIST).toHaveLength(6);
    const ids = BOT_ORB_THEME_LIST.map(t => t.id);
    expect(ids).toEqual([
      "arven",
      "zeno",
      "veya",
      "koda",
      "luma",
      "orin",
    ]);
  });

  it("gives each of the 6 options a distinct custom name and combination label", () => {
    const names = BOT_ORB_THEME_LIST.map(t => t.name);
    expect(names).toEqual([
      "Arven",
      "Zeno",
      "Veya",
      "Koda",
      "Luma",
      "Orin",
    ]);

    const combinations = BOT_ORB_THEME_LIST.map(t => t.combinationLabel);
    expect(combinations).toEqual([
      "Crimson Red",
      "Electric Cyan",
      "Emerald Green",
      "Sapphire Blue",
      "Cosmic Violet",
      "Solar Gold",
    ]);
  });

  it("gives each of the 6 options a distinct custom previewPhrase without project name", () => {
    const phrases = BOT_ORB_THEME_LIST.map(t => t.previewPhrase);
    expect(phrases).toEqual([
      "Hey there, I'm Arven! Great to meet you, tell me what's on your mind today.",
      "Hi there, I'm Zeno! I'm super excited to chat, let's jump right in!",
      "Hi, I'm Veya! It's so nice to meet you, what would you like to talk about?",
      "Hey, I'm Koda! Always happy to hang out and help you with anything today.",
      "Hi there, I'm Luma! I'm so excited to see what fun ideas we come up with.",
      "Hello there, I'm Orin! Wishing you a wonderful day, what shall we chat about?",
    ]);

    for (const phrase of phrases) {
      expect(phrase.toLowerCase()).not.toContain("ksemo");
    }
  });

  it("defines continuous rolling conic-gradients with center point along with black", () => {
    for (const theme of BOT_ORB_THEME_LIST) {
      expect(theme.rollingGradient).toBeDefined();
      expect(theme.rollingGradient).toContain("conic-gradient(from 0deg at 50% 50%");
      expect(theme.rollingGradient).toContain("#000000");
    }
  });

  it("defines realistic 3D sphere gradient styling with inner bounce glow", () => {
    const cyanTheme = BOT_ORB_THEMES["black-cyan"];
    const style = getSphereStyle(cyanTheme);

    expect(style.background).toBe("#000000");
    expect(style.boxShadow).toContain(cyanTheme.bounceColor);
    expect(style.boxShadow).toContain("0 6px 14px -1px rgba(0, 0, 0, 0.75)");
  });

  describe("browser storage interaction", () => {
    let mockStorage: Record<string, string> = {};

    beforeEach(() => {
      mockStorage = {};
      const fakeLocalStorage = {
        getItem: (k: string) => mockStorage[k] ?? null,
        setItem: (k: string, v: string) => {
          mockStorage[k] = v;
        },
        removeItem: (k: string) => {
          delete mockStorage[k];
        },
        clear: () => {
          mockStorage = {};
        },
      };

      const fakeWindow = {
        localStorage: fakeLocalStorage,
        dispatchEvent: () => true,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      };

      // @ts-expect-error test mock
      globalThis.window = fakeWindow;
      // @ts-expect-error test mock
      globalThis.localStorage = fakeLocalStorage;
    });

    afterEach(() => {
      // @ts-expect-error test cleanup
      delete globalThis.window;
      // @ts-expect-error test cleanup
      delete globalThis.localStorage;
    });

    it("reads and persists theme selection in localStorage and falls back to default", () => {
      expect(getStoredBotOrbThemeId()).toBe(DEFAULT_BOT_ORB_THEME_ID);

      setStoredBotOrbThemeId("black-gold");
      expect(globalThis.localStorage.getItem(STORAGE_KEY)).toBe("black-gold");
      expect(getStoredBotOrbThemeId()).toBe("black-gold");

      setStoredBotOrbThemeId("black-violet");
      expect(getStoredBotOrbThemeId()).toBe("black-violet");
    });
  });
});
