// Smoke tests for the deterministic document generators and the quality
// validation engine. These run fully offline (no LLM, no network) and verify
// that each generator produces a real, openable file with valid format bytes.

import { describe, expect, it } from "vitest";
import {
  generateDocument,
  generatePdf,
  generateDocx,
  generateXlsx,
  generatePptx,
  generateTxt,
} from "./generate";
import { validateDocument } from "./quality";
import { FORMAT_MIME, sanitizeFilename, coerceBlocks, coerceSheets, coerceSlides } from "./spec";
import type { DocumentSpec, DocFormat } from "./spec";

function textSpec(format: "pdf" | "docx" | "txt"): DocumentSpec {
  return {
    format,
    filename: `sample.${format}`,
    title: "Sample Report",
    blocks: [
      { type: "heading", level: 1, text: "Sample Report" },
      { type: "heading", level: 2, text: "Overview" },
      {
        type: "paragraph",
        text: "This is a sample paragraph used to exercise the deterministic generators. It contains enough text to be representative of real content produced by the document pipeline.",
      },
      { type: "paragraph", text: "A second paragraph with additional factual detail for the report body." },
      { type: "bulletList", items: ["First key point", "Second key point", "Third key point"] },
      {
        type: "table",
        headers: ["Name", "Value"],
        rows: [
          ["Alpha", "1"],
          ["Beta", "2"],
        ],
      },
    ],
  };
}

function sheetSpec(): DocumentSpec {
  return {
    format: "xlsx",
    filename: "sample.xlsx",
    title: "Quarterly Figures",
    sheets: [
      {
        name: "Data",
        rows: [
          ["Region", "Q1", "Q2"],
          ["North", 10, 12],
          ["South", 8, 9],
        ],
      },
    ],
  };
}

function slideSpec(): DocumentSpec {
  return {
    format: "pptx",
    filename: "sample.pptx",
    title: "Quarterly Review",
    slides: [
      { title: "Quarterly Review", subtitle: "Executive summary", bullets: ["Growth is on track", "Margins improved"] },
      { title: "Outlook", bullets: ["Expand into new markets", "Invest in R&D"] },
    ],
  };
}

describe("document generators", () => {
  it.each<["pdf" | "docx" | "txt", string]>([
    ["pdf", "%PDF"],
    ["docx", "PK"],
    ["txt", ""],
  ])("generateDocument produces a real %s file", async (format, magic) => {
    const { buffer, filename, mimeType } = await generateDocument(textSpec(format));
    expect(buffer.length).toBeGreaterThan(0);
    expect(filename).toBe(`sample.${format}`);
    expect(mimeType).toBe(FORMAT_MIME[format]);
    if (magic) {
      expect(buffer.slice(0, magic.length).toString("ascii")).toBe(magic);
    }
  });

  it("generatePdf produces valid PDF bytes with footer", async () => {
    const buffer = await generatePdf(textSpec("pdf"));
    expect(buffer.toString("ascii", 0, 8)).toContain("%PDF");
    expect(buffer.slice(-32).toString("ascii")).toContain("%%EOF");
  });

  it("generateDocx produces a ZIP archive", async () => {
    const buffer = await generateDocx(textSpec("docx"));
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });

  it("generateXlsx produces a ZIP workbook with data sheet", () => {
    const buffer = generateXlsx(sheetSpec());
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });

  it("generatePptx produces a ZIP presentation", async () => {
    const buffer = await generatePptx(slideSpec());
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });

  it("generateTxt includes the title and block content", () => {
    const buffer = generateTxt(textSpec("txt"));
    const text = buffer.toString("utf8");
    expect(text).toContain("Sample Report");
    expect(text).toContain("First key point");
  });
});

describe("quality validation", () => {
  it.each<DocFormat>(["pdf", "docx", "xlsx", "pptx", "txt"])(
    "passes real %s output with byte-level check",
    async format => {
      const spec =
        format === "xlsx"
          ? sheetSpec()
          : format === "pptx"
            ? slideSpec()
            : textSpec(format as "pdf" | "docx" | "txt");
      const { buffer } = await generateDocument(spec);
      const report = validateDocument(spec, buffer);
      expect(report.passed).toBe(true);
      expect(report.stats.byteSize).toBe(buffer.length);
      expect(report.issues.filter(i => i.severity === "error")).toHaveLength(0);
    }
  );

  it("flags a corrupted PDF buffer as an error", () => {
    const spec = textSpec("pdf");
    const report = validateDocument(spec, Buffer.from("definitely not a pdf document", "utf8"));
    expect(report.passed).toBe(false);
    expect(report.issues.some(i => i.category === "file" && i.severity === "error")).toBe(true);
  });

  it("flags an empty buffer as an error", () => {
    const spec = textSpec("txt");
    const report = validateDocument(spec, Buffer.alloc(0));
    expect(report.passed).toBe(false);
    expect(report.issues.some(i => i.message.includes("empty"))).toBe(true);
  });

  it("flags a spec with no content blocks as an error", () => {
    const spec: DocumentSpec = { format: "pdf", filename: "empty.pdf", title: "Empty" };
    const report = validateDocument(spec, Buffer.from("%PDF-1.7\n%%EOF", "utf8"));
    expect(report.passed).toBe(false);
  });
});

describe("spec helpers", () => {
  it("sanitizeFilename neutralizes path separators and keeps the extension", () => {
    const name = sanitizeFilename("pdf", "..\\..\\evil");
    expect(name.endsWith(".pdf")).toBe(true);
    expect(name).not.toMatch(/[\\/]/);
    expect(sanitizeFilename("xlsx")).toBe("document.xlsx");
  });

  it("coerceBlocks keeps only valid blocks", () => {
    const blocks = coerceBlocks([
      { type: "paragraph", text: "ok" },
      { type: "nonsense" },
      { type: "heading", level: 2, text: "Section" },
    ]);
    expect(blocks).toHaveLength(2);
  });

  it("coerceSheets normalizes row data", () => {
    const sheets = coerceSheets([{ name: "A", rows: [["x", "y"]] }]);
    expect(sheets.length).toBe(1);
  });

  it("coerceSlides produces at least one slide", () => {
    const slides = coerceSlides([{ title: "One" }]);
    expect(slides.length).toBeGreaterThan(0);
  });

  it("FORMAT_MIME maps every documented format", () => {
    expect(FORMAT_MIME.pdf).toBe("application/pdf");
    expect(FORMAT_MIME.txt).toBe("text/plain");
  });
});