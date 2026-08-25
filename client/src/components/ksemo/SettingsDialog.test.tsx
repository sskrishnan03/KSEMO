import { describe, expect, it } from "vitest";
import { settingsSections } from "./SettingsDialog";

describe("KSEMO settings", () => {
  it("has a general section", () => {
    expect(settingsSections.map(section => section.label)).toEqual(["General"]);
  });
});
