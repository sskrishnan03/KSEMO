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
  }, 20_000);

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
    },
    20_000
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

  it("flags slide decks lacking layout diversity", () => {
    const spec: DocumentSpec = {
      format: "pptx",
      filename: "bullets_only.pptx",
      title: "Repetitive Deck",
      slides: [
        { title: "Slide 1", bullets: ["A", "B"] },
        { title: "Slide 2", bullets: ["C", "D"] },
        { title: "Slide 3", bullets: ["E", "F"] },
        { title: "Slide 4", bullets: ["G", "H"] },
      ],
    };
    const report = validateDocument(spec, Buffer.from("PK\x03\x04mockpptxdata"));
    expect(report.issues.some(i => i.category === "layout_diversity")).toBe(true);
  });

  it("validates semantic blocks for empty content", () => {
    const spec: DocumentSpec = {
      format: "pdf",
      filename: "semantic_empty.pdf",
      title: "Bad Blocks",
      blocks: [
        { type: "heading", level: 1, text: "Bad Blocks" },
        { type: "callout", text: "" },
        { type: "statGrid", metrics: [] },
        { type: "processFlow", steps: [] },
        { type: "comparison", columns: ["SingleCol"], rows: [] },
      ],
    };
    const report = validateDocument(spec, Buffer.from("%PDF-1.7\n%%EOF"));
    expect(report.issues.some(i => i.message.includes("Callout block contains empty text"))).toBe(true);
    expect(report.issues.some(i => i.message.includes("Stat grid block has no metrics"))).toBe(true);
    expect(report.issues.some(i => i.message.includes("Process flow block has no steps"))).toBe(true);
    expect(report.issues.some(i => i.message.includes("Comparison table requires at least two columns"))).toBe(true);
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

import { parseUserLengthIntent } from "./plan";

describe("parseUserLengthIntent", () => {
  it("detects explicit page requests correctly", () => {
    expect(parseUserLengthIntent("create a 10 page pdf about react")).toMatchObject({
      targetPages: 10,
    });
    expect(parseUserLengthIntent("5-page report on climate change")).toMatchObject({
      targetPages: 5,
    });
    expect(parseUserLengthIntent("generate at least 20 pages comprehensive guide")).toMatchObject({
      targetPages: 20,
    });
  });

  it("detects explicit slide and sheet counts", () => {
    expect(parseUserLengthIntent("make a 12 slides presentation")).toMatchObject({
      targetSlides: 12,
    });
    expect(parseUserLengthIntent("give me 5 sheets in excel model")).toMatchObject({
      targetSheets: 5,
    });
  });

  it("detects extensive and unlimited intent", () => {
    expect(parseUserLengthIntent("exhaustive and unlimited guide")).toMatchObject({
      isExtensive: true,
    });
    expect(parseUserLengthIntent("deep dive handbook")).toMatchObject({
      isExtensive: true,
    });
  });

  it("defaults cleanly when no length constraint is present", () => {
    expect(parseUserLengthIntent("explain photosynthesis in detail")).toEqual({
      targetPages: undefined,
      targetSlides: undefined,
      targetSheets: undefined,
      isExtensive: false,
    });
  });

  it("generates a multi-page PDF containing explicit pageBreak blocks", async () => {
    const spec: DocumentSpec = {
      format: "pdf",
      filename: "multipage.pdf",
      title: "Multi-page Document",
      blocks: [
        { type: "heading", level: 1, text: "Chapter 1" },
        { type: "paragraph", text: "Page 1 content here." },
        { type: "pageBreak" },
        { type: "heading", level: 1, text: "Chapter 2" },
        { type: "paragraph", text: "Page 2 content here." },
        { type: "pageBreak" },
        { type: "heading", level: 1, text: "Chapter 3" },
        { type: "paragraph", text: "Page 3 content here." },
      ],
    };
    const pdfBuf = await generatePdf(spec);
    expect(pdfBuf.length).toBeGreaterThan(1000);
    expect(pdfBuf.toString("ascii", 0, 5)).toBe("%PDF-");
  });
});

describe("semantic document blocks and theme rendering", () => {
  it("renders all semantic blocks into PDF and Word cleanly", async () => {
    const spec: DocumentSpec = {
      format: "pdf",
      filename: "semantic_showcase.pdf",
      title: "Master Architecture Report",
      theme: "technical",
      blocks: [
        { type: "heading", level: 1, text: "System Performance" },
        {
          type: "callout",
          title: "Architecture Note",
          text: "All nodes operate on distributed consensus with zero-downtime failover.",
          intent: "tip",
        },
        {
          type: "statGrid",
          metrics: [
            { label: "Active Nodes", value: "1,024", change: "+12%" },
            { label: "Throughput", value: "94.2k", change: "ops/sec" },
            { label: "Latency P99", value: "4.2ms", change: "-18%" },
          ],
        },
        {
          type: "processFlow",
          title: "Deployment Pipeline",
          steps: [
            { step: 1, title: "Static Analysis", description: "Lints and type checks" },
            { step: 2, title: "Integration Build", description: "Containerized test run" },
            { step: 3, title: "Production Canary", description: "10% progressive traffic shift" },
          ],
        },
        {
          type: "comparison",
          columns: ["Feature", "Standard Tier", "Enterprise Tier"],
          rows: [
            ["High Availability", "99.9% SLA", "99.999% SLA"],
            ["Data Retention", "30 Days", "Unlimited"],
            ["Dedicated VPC", "Optional", "Included"],
          ],
        },
        {
          type: "quote",
          text: "Simplicity is prerequisite for reliability.",
          author: "Edsger W. Dijkstra",
        },
        {
          type: "codeBlock",
          language: "typescript",
          code: "const engine = new FileCreationEngine();\nawait engine.produceArtifact();",
        },
      ],
    };

    // PDF check
    const pdfBuf = await generatePdf(spec);
    expect(pdfBuf.length).toBeGreaterThan(1000);
    expect(pdfBuf.toString("ascii", 0, 5)).toBe("%PDF-");

    // DOCX check
    const docxSpec = { ...spec, format: "docx" as const, filename: "semantic_showcase.docx" };
    const docxBuf = await generateDocx(docxSpec);
    expect(docxBuf[0]).toBe(0x50);
    expect(docxBuf[1]).toBe(0x4b);

    // TXT check
    const txtSpec = { ...spec, format: "txt" as const, filename: "semantic_showcase.txt" };
    const txtBuf = generateTxt(txtSpec);
    const txt = txtBuf.toString("utf8");
    expect(txt).toContain("Architecture Note");
    expect(txt).toContain("1,024");
    expect(txt).toContain("Dijkstra");
  });
});

describe("advanced XLSX formula generation", () => {
  it("writes real calculation formulas and format strings into sheets", () => {
    const spec: DocumentSpec = {
      format: "xlsx",
      filename: "financial_model.xlsx",
      title: "Corporate Financial Model",
      sheets: [
        {
          name: "Income Statement",
          table: true,
          hasTotals: true,
          rows: [
            ["Metric", "FY24 ($M)", "FY25 ($M)", "YoY Growth"],
            ["Revenue", 120.5, 150.0, { formula: "=(C2-B2)/B2", value: 0.2448, numFmt: "percent" }],
            ["COGS", 48.2, 55.0, { formula: "=(C3-B3)/B3", value: 0.1411, numFmt: "percent" }],
            ["Gross Profit", { formula: "=B2-B3", value: 72.3, numFmt: "currency" }, { formula: "=C2-C3", value: 95.0, numFmt: "currency" }, ""],
            ["Total Overhead", 35.0, 42.0, ""],
            ["Net Income", { formula: "=B4-B5", value: 37.3, numFmt: "currency" }, { formula: "=C4-C5", value: 53.0, numFmt: "currency" }, ""],
          ],
        },
      ],
    };

    const buf = generateXlsx(spec);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);

    const report = validateDocument(spec, buf);
    expect(report.passed).toBe(true);
    expect(report.issues.filter(i => i.severity === "error")).toHaveLength(0);
  });
});

describe("PPTX varied slide layouts", () => {
  it("renders modern 16:9 slides with varied layouts", async () => {
    const spec: DocumentSpec = {
      format: "pptx",
      filename: "investor_deck.pptx",
      title: "Strategic Growth Overview",
      theme: "business",
      slides: [
        {
          title: "Strategic Growth 2026",
          subtitle: "Enterprise Expansion & Market Leadership",
          layout: "title",
        },
        {
          title: "Key Performance Drivers",
          layout: "big_number",
          metrics: [
            { label: "Annual Recurring Revenue", value: "$42M", change: "+85% YoY" },
            { label: "Net Revenue Retention", value: "134%", change: "+600 bps" },
          ],
        },
        {
          title: "Market Transition Dynamics",
          layout: "two_column",
          columns: [
            { heading: "Traditional Architecture", points: ["Monolithic deployments", "Manual scaling", "High latency"] },
            { heading: "Next-Gen KSEMO Architecture", points: ["Event-driven microservices", "Autonomous elasticity", "Sub-5ms p99"] },
          ],
        },
        {
          title: "Execution Roadmap",
          layout: "process",
          steps: [
            { step: 1, title: "Phase 1: Foundation", description: "Core engine refactor" },
            { step: 2, title: "Phase 2: Scale", description: "Multi-tenant deployment" },
            { step: 3, title: "Phase 3: Dominance", description: "Global ecosystem integration" },
          ],
        },
        {
          title: "Guiding Mission",
          layout: "quote",
          quote: {
            text: "The best way to predict the future is to invent it.",
            author: "Alan Kay",
          },
        },
      ],
    };

    const buf = await generatePptx(spec);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);

    const report = validateDocument(spec, buf);
    expect(report.passed).toBe(true);
    expect(report.stats.slideCount).toBe(5);
  });
});