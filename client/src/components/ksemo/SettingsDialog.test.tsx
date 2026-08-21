import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { settingsSections, SettingsAccessibilityPanel } from "./SettingsDialog";

describe("KSEMO accessibility and recovery settings", () => {
  it("renders persisted motion preference, keyboard guidance, and a reload recovery control", () => {
    const markup = renderToStaticMarkup(
      createElement(SettingsAccessibilityPanel, {
        reduceMotion: false,
        onReduceMotionChange: () => undefined,
        online: true,
        onReload: () => undefined,
      })
    );
    expect(markup).toContain("Reduce motion");
    expect(markup).toContain("Keyboard shortcuts");
    expect(markup).toContain("⌘/Ctrl K");
    expect(markup).toContain("Connection and recovery");
    expect(markup).toContain("Reload KSEMO");
  });

  it("exposes account, security, preferences, data controls, and feedback sections", () => {
    expect(settingsSections.map(section => section.label)).toEqual([
      "Account",
      "Security",
      "Preferences",
      "Data controls",
      "Feedback",
    ]);
  });
});
