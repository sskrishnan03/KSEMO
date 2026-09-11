import { describe, expect, it } from "vitest";
import { extractFileText, ensureExtractedContent } from "./fileExtract";
import { inMemoryStore } from "./inMemoryStore";
import { getFileKind } from "../client/src/lib/fileKinds";
import { storagePut } from "./storage";

describe("File Extraction & Attachment System", () => {
  it("extracts plain text and markdown files with full content", async () => {
    const mdContent = "# Quarterly Results\n\n- Revenue: $10M\n- Profit: $2.5M\n";
    const text = await extractFileText(
      "report.md",
      "text/markdown",
      Buffer.from(mdContent, "utf-8")
    );
    expect(text).not.toBeNull();
    expect(text).toContain("# Quarterly Results");
    expect(text).toContain("Revenue: $10M");
  });

  it("extracts CSV files into structured Markdown tables", async () => {
    const csvContent = "Month,Sales,Target,Variance\nJanuary,100,90,10\nFebruary,120,110,10\nMarch,150,130,20\n";
    const text = await extractFileText(
      "sales.csv",
      "text/csv",
      Buffer.from(csvContent, "utf-8")
    );
    expect(text).not.toBeNull();
    expect(text).toContain("| Month | Sales | Target | Variance |");
    expect(text).toContain("| January | 100 | 90 | 10 |");
    expect(text).toContain("| March | 150 | 130 | 20 |");
  });

  it("extracts code files correctly", async () => {
    const codeContent = "function calculateTotal(items: number[]): number {\n  return items.reduce((a, b) => a + b, 0);\n}\n";
    const text = await extractFileText(
      "calculator.ts",
      "text/plain",
      Buffer.from(codeContent, "utf-8")
    );
    expect(text).not.toBeNull();
    expect(text).toContain("calculateTotal");
    expect(text).toContain("reduce");
  });

  it("saves files, attaches them to messages, and retrieves them reliably", async () => {
    const testUserId = 999;
    const testMessageId = crypto.randomUUID();
    const testConvId = crypto.randomUUID();

    // 1. Put file in storage
    const put = await storagePut(
      "test_data.txt",
      Buffer.from("Sample data for test attachment", "utf-8"),
      "text/plain"
    );

    // 2. Create file record in store
    const file = await inMemoryStore.createFileForUser({
      userId: testUserId,
      filename: "test_data.txt",
      mimeType: "text/plain",
      sizeBytes: 31,
      storageKey: put.key,
      url: put.url,
      contentText: "Sample data for test attachment",
    });

    expect(file.id).toBeDefined();

    // 3. Attach file to message
    const att = await inMemoryStore.attachFileToMessageForUser({
      id: crypto.randomUUID(),
      fileId: String(file.id),
      messageId: testMessageId,
      conversationId: testConvId,
      userId: testUserId,
    });

    expect(att.id).toBeDefined();
    expect(att.messageId).toBe(testMessageId);

    // 4. Retrieve message files
    const media = await inMemoryStore.listMessageFilesForUser(
      testMessageId,
      testUserId
    );

    expect(media).toHaveLength(1);
    expect(media[0].filename).toBe("test_data.txt");
    expect(media[0].contentText).toBe("Sample data for test attachment");

    // 5. Check on-demand extraction via ensureExtractedContent
    const extracted = await ensureExtractedContent(media[0]);
    expect(extracted).toBe("Sample data for test attachment");
  });

  it("classifies file kinds correctly for UI icons and labels", () => {
    expect(getFileKind("chart.png", "image/png").label).toBe("Image");
    expect(getFileKind("document.pdf", "application/pdf").label).toBe("PDF");
    expect(getFileKind("data.csv", "text/csv").label).toBe("Sheet");
    expect(getFileKind("spreadsheet.xlsx").label).toBe("Sheet");
    expect(getFileKind("notes.md", "text/markdown").label).toBe("Markdown");
    expect(getFileKind("recording.mp3", "audio/mp3").label).toBe("Audio");
    expect(getFileKind("video.mp4", "video/mp4").label).toBe("Video");
    expect(getFileKind("index.ts", "text/plain").label).toBe("Code");
    expect(getFileKind("archive.zip").label).toBe("Archive");
  });
});
