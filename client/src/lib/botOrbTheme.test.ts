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
  it("contains exactly 5 distinct black and color combinations", () => {
    expect(BOT_ORB_THEME_LIST).toHaveLength(5);
    const ids = BOT_ORB_THEME_LIST.map(t => t.id);
    expect(ids).toEqual([
      "black-white",
      "black-cyan",
      "black-emerald",
      "black-violet",
      "black-gold",
    ]);
  });

  it("gives each of the 5 options a distinct Black & Color name and combination label", () => {
    const names = BOT_ORB_THEME_LIST.map(t => t.name);
    expect(names).toEqual([
      "Black & White",
      "Black & Cyan",
      "Black & Emerald",
      "Black & Violet",
      "Black & Gold",
    ]);

    const combinations = BOT_ORB_THEME_LIST.map(t => t.combinationLabel);
    expect(combinations).toEqual([
      "Black & Pearl White",
      "Black & Electric Cyan",
      "Black & Emerald Green",
      "Black & Cosmic Violet",
      "Black & Solar Gold",
    ]);
  });

  it("defines continuous rolling conic-gradients with center point along with black", () => {
    for (const theme of BOT_ORB_THEME_LIST) {
      expect(theme.rollingGradient).toBeDefined();
      expect(theme.rollingGradient).toContain("conic-gradient(from 0deg at 50% 50%");
      expect(theme.rollingGradient).toContain("#000000");
    }
  });

  it("defines realistic 3D sphere gradient styling with specular glint and inner core glow", () => {
    const cyanTheme = BOT_ORB_THEMES["black-cyan"];
    const style = getSphereStyle(cyanTheme);

    expect(style.background).toBe("#000000");
    expect(style.boxShadow).toContain("inset 0 1.5px 2px rgba(255, 255, 255, 0.45)");
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
