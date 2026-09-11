import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { settingsSections, SettingsSearch } from "./SettingsDialog";

describe("KSEMO settings", () => {
  it("has a general section", () => {
    expect(settingsSections.map(section => section.label)).toEqual(["General"]);
  });

  it("renders the settings search bar", () => {
    const markup = renderToStaticMarkup(
      createElement(SettingsSearch, { onSelect: () => undefined })
    );
    expect(markup).toContain('placeholder="Search settings…"');
    expect(markup).toContain('aria-label="Search settings"');
  });
});
