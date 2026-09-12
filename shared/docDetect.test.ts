import { describe, expect, it } from "vitest";
import {
  detectFileRequest,
  resolveFormatKeyword,
  cleanPromptText,
  looksLikeFileRequest,
  likelyFormatHint,
} from "./docDetect";

describe("resolveFormatKeyword", () => {
  it("resolves pdf variations", () => {
    expect(resolveFormatKeyword("pdf")).toBe("pdf");
    expect(resolveFormatKeyword("pdf file")).toBe("pdf");
    expect(resolveFormatKeyword("pdf document")).toBe("pdf");
    expect(resolveFormatKeyword("PDF")).toBe("pdf");
  });

  it("resolves docx variations", () => {
    expect(resolveFormatKeyword("word")).toBe("docx");
    expect(resolveFormatKeyword("docx")).toBe("docx");
    expect(resolveFormatKeyword("doc")).toBe("docx");
    expect(resolveFormatKeyword("word document")).toBe("docx");
    expect(resolveFormatKeyword("ms word")).toBe("docx");
  });

  it("resolves xlsx variations", () => {
    expect(resolveFormatKeyword("excel")).toBe("xlsx");
    expect(resolveFormatKeyword("xlsx")).toBe("xlsx");
    expect(resolveFormatKeyword("xls")).toBe("xlsx");
    expect(resolveFormatKeyword("spreadsheet")).toBe("xlsx");
    expect(resolveFormatKeyword("excel sheet")).toBe("xlsx");
  });

  it("resolves pptx variations", () => {
    expect(resolveFormatKeyword("powerpoint")).toBe("pptx");
    expect(resolveFormatKeyword("pptx")).toBe("pptx");
    expect(resolveFormatKeyword("ppt")).toBe("pptx");
    expect(resolveFormatKeyword("presentation")).toBe("pptx");
    expect(resolveFormatKeyword("slides")).toBe("pptx");
  });

  it("resolves txt variations", () => {
    expect(resolveFormatKeyword("txt")).toBe("txt");
    expect(resolveFormatKeyword("text")).toBe("txt");
    expect(resolveFormatKeyword("text file")).toBe("txt");
    expect(resolveFormatKeyword("plain text")).toBe("txt");
  });

  it("returns null for unknown keywords", () => {
    expect(resolveFormatKeyword("something else")).toBeNull();
    expect(resolveFormatKeyword("random")).toBeNull();
  });
});

describe("detectFileRequest", () => {
  describe("natural language requests with 'I want this in...'", () => {
    it("detects 'I want this in PDF'", () => {
      const res = detectFileRequest("I want this in PDF");
      expect(res.isFileRequest).toBe(true);
      expect(res.format).toBe("pdf");
    });

    it("detects 'while giving in question I want in this I want this in PDF'", () => {
      const res = detectFileRequest(
        "while giving in question I want in this I want this in PDF"
      );
      expect(res.isFileRequest).toBe(true);
      expect(res.format).toBe("pdf");
    });

    it("detects 'give me this in PDF'", () => {
      const res = detectFileRequest("give me this in PDF");
      expect(res.isFileRequest).toBe(true);
      expect(res.format).toBe("pdf");
    });

    it("detects 'can you give me this in PDF'", () => {
      const res = detectFileRequest("can you give me this in PDF");
      expect(res.isFileRequest).toBe(true);
      expect(res.format).toBe("pdf");
    });

    it("detects 'I want this in Word'", () => {
      const res = detectFileRequest("I want this in Word");
      expect(res.isFileRequest).toBe(true);
      expect(res.format).toBe("docx");
    });

    it("detects 'I want this in docx'", () => {
      const res = detectFileRequest("I want this in docx");
      expect(res.isFileRequest).toBe(true);
      expect(res.format).toBe("docx");
    });

    it("detects 'I want this in Excel'", () => {
      const res = detectFileRequest("I want this in Excel");
      expect(res.isFileRequest).toBe(true);
      expect(res.format).toBe("xlsx");
    });

    it("detects 'give me this in spreadsheet'", () => {
      const res = detectFileRequest("give me this in spreadsheet");
      expect(res.isFileRequest).toBe(true);
      expect(res.format).toBe("xlsx");
    });

    it("detects 'I want this in PowerPoint'", () => {
      const res = detectFileRequest("I want this in PowerPoint");
      expect(res.isFileRequest).toBe(true);
      expect(res.format).toBe("pptx");
    });

    it("detects 'make this into a presentation'", () => {
      const res = detectFileRequest("make this into a presentation");
      expect(res.isFileRequest).toBe(true);
      expect(res.format).toBe("pptx");
    });

    it("detects 'I want this in text file'", () => {
      const res = detectFileRequest("I want this in text file");
      expect(res.isFileRequest).toBe(true);
      expect(res.format).toBe("txt");
    });

    it("detects 'give me this in txt'", () => {
      const res = detectFileRequest("give me this in txt");
      expect(res.isFileRequest).toBe(true);
      expect(res.format).toBe("txt");
    });

    it("detects 'convert this to PDF'", () => {
      const res = detectFileRequest("convert this to PDF");
      expect(res.isFileRequest).toBe(true);
      expect(res.format).toBe("pdf");
    });

    it("detects 'export this as a PDF document'", () => {
      const res = detectFileRequest("export this as a PDF document");
      expect(res.isFileRequest).toBe(true);
      expect(res.format).toBe("pdf");
    });
  });

  describe("direct creation commands", () => {
    it("detects 'create a PDF of the company profile'", () => {
      const res = detectFileRequest("create a PDF of the company profile");
      expect(res.isFileRequest).toBe(true);
      expect(res.format).toBe("pdf");
    });

    it("detects 'generate an excel sheet for quarterly revenue'", () => {
      const res = detectFileRequest("generate an excel sheet for quarterly revenue");
      expect(res.isFileRequest).toBe(true);
      expect(res.format).toBe("xlsx");
    });

    it("detects 'make a powerpoint presentation about AI'", () => {
      const res = detectFileRequest("make a powerpoint presentation about AI");
      expect(res.isFileRequest).toBe(true);
      expect(res.format).toBe("pptx");
    });

    it("detects 'write a word document resume for software engineer'", () => {
      const res = detectFileRequest("write a word document resume for software engineer");
      expect(res.isFileRequest).toBe(true);
      expect(res.format).toBe("docx");
    });

    it("detects 'create a text file with python scripts'", () => {
      const res = detectFileRequest("create a text file with python scripts");
      expect(res.isFileRequest).toBe(true);
      expect(res.format).toBe("txt");
    });
  });

  describe("combined question + file format", () => {
    it("detects 'Explain photosynthesis, I want this in PDF'", () => {
      const res = detectFileRequest("Explain photosynthesis, I want this in PDF");
      expect(res.isFileRequest).toBe(true);
      expect(res.format).toBe("pdf");
    });

    it("detects 'Summarize Q3 earnings and give me this in Excel'", () => {
      const res = detectFileRequest("Summarize Q3 earnings and give me this in Excel");
      expect(res.isFileRequest).toBe(true);
      expect(res.format).toBe("xlsx");
    });

    it("detects 'Key principles of clean code in PowerPoint slides'", () => {
      const res = detectFileRequest("Key principles of clean code in PowerPoint slides");
      expect(res.isFileRequest).toBe(true);
      expect(res.format).toBe("pptx");
    });
  });

  describe("slash commands and prefixes", () => {
    it("detects '/pdf project roadmap'", () => {
      const res = detectFileRequest("/pdf project roadmap");
      expect(res.isFileRequest).toBe(true);
      expect(res.format).toBe("pdf");
      expect(res.cleanedPrompt).toBe("project roadmap");
    });

    it("detects '/xlsx employee salary table'", () => {
      const res = detectFileRequest("/xlsx employee salary table");
      expect(res.isFileRequest).toBe(true);
      expect(res.format).toBe("xlsx");
      expect(res.cleanedPrompt).toBe("employee salary table");
    });

    it("detects 'word: executive summary'", () => {
      const res = detectFileRequest("word: executive summary");
      expect(res.isFileRequest).toBe(true);
      expect(res.format).toBe("docx");
      expect(res.cleanedPrompt).toBe("executive summary");
    });
  });

  describe("informational questions should NOT be file requests", () => {
    it("rejects 'What is a PDF?'", () => {
      const res = detectFileRequest("What is a PDF?");
      expect(res.isFileRequest).toBe(false);
    });

    it("rejects 'How do I open docx files?'", () => {
      const res = detectFileRequest("How do I open docx files?");
      expect(res.isFileRequest).toBe(false);
    });

    it("rejects 'Tell me about Excel formulas'", () => {
      const res = detectFileRequest("Tell me about Excel formulas");
      expect(res.isFileRequest).toBe(false);
    });

    it("rejects normal chat question: 'What is the capital of France?'", () => {
      const res = detectFileRequest("What is the capital of France?");
      expect(res.isFileRequest).toBe(false);
    });

    it("rejects 'In other words, can you clarify?'", () => {
      const res = detectFileRequest("In other words, can you clarify?");
      expect(res.isFileRequest).toBe(false);
    });
  });

  describe("backward compatibility helpers", () => {
    it("looksLikeFileRequest works", () => {
      expect(looksLikeFileRequest("I want this in PDF")).toBe(true);
      expect(looksLikeFileRequest("Tell me a joke")).toBe(false);
    });

    it("likelyFormatHint works", () => {
      expect(likelyFormatHint("give me this in PDF")).toBe("pdf");
      expect(likelyFormatHint("I want this in Excel")).toBe("xlsx");
      expect(likelyFormatHint("Tell me a story")).toBeNull();
    });
  });
});
