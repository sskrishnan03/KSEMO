import { describe, expect, it } from "vitest";
import {
  createConversationPdfFile,
  createConversationWordFile,
  createPdfFile,
} from "./conversationExport";

describe("createPdfFile", () => {
  it("preserves a long conversation over multiple pages rather than truncating it", async () => {
    const source = Array.from(
      { length: 55 },
      (_, index) => `Turn ${index + 1}`
    ).join("\n");
    const pdf = await createPdfFile(source).text();

    expect(pdf).toContain("/Count 2");
    expect(pdf).toContain("(Turn 1)");
    expect(pdf).toContain("(Turn 55)");
    expect(pdf).toContain("/Type /Page");
  });

  it("places user turns on the right and assistant turns on the left in PDF and Word exports", async () => {
    const messages = [
      { role: "user" as const, content: "User request" },
      { role: "assistant" as const, content: "Assistant reply" },
    ];
    const pdf = await createConversationPdfFile(
      "Layout check",
      messages
    ).text();
    const word = await createConversationWordFile(
      "Layout check",
      messages
    ).text();
    expect(pdf).toContain("(You)");
    expect(pdf).toContain("(KSEMO)");
    expect(pdf.indexOf("(You)")).toBeLessThan(pdf.indexOf("(KSEMO)"));
    expect(word).toContain('class="turn user"');
    expect(word).toContain('class="turn assistant"');
    expect(word).toContain("text-align:right");
    expect(word).toContain("text-align:left");
    expect(word).toContain("width:94%");
    expect(word).toContain("margin-left:auto");
    expect(word).toContain("margin-right:auto");
  });
});
