import { describe, expect, it } from "vitest";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";

describe("KSEMO shared delete confirmation", () => {
  it("provides the shared ConfirmDeleteDialog component", () => {
    expect(typeof ConfirmDeleteDialog).toBe("function");
  });
});