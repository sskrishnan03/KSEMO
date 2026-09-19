import { describe, expect, it } from "vitest";
import { generatePythonScript } from "./pythonGenerator";
import { executePythonCode, getPythonExecutable } from "../services/pythonExecutor";

describe("Python Generator and Executor", () => {
  it("detects a valid python executable", async () => {
    const pythonPath = await getPythonExecutable();
    expect(pythonPath).toBeTruthy();
  });

  it("generates valid Python code for txt format and executes it", async () => {
    const spec: any = {
      format: "txt",
      filename: "test.txt",
      title: "Test Title",
      summary: "Test Summary",
      blocks: [
        { type: "heading", level: 1, text: "Section 1" },
        { type: "paragraph", text: "This is a paragraph." },
        { type: "bulletList", items: ["Item 1", "Item 2"] }
      ]
    };

    const pythonCode = generatePythonScript(spec);
    expect(pythonCode).toContain("build_text");

    const result = await executePythonCode(pythonCode);
    expect(result.success).toBe(true);
    expect(result.fileBuffer.length).toBeGreaterThan(0);
    expect(result.fileBuffer.toString("utf8")).toContain("Section 1");
  });

  it("generates valid Python code for docx and executes it", async () => {
    const spec: any = {
      format: "docx",
      filename: "test.docx",
      title: "Document Title",
      summary: "Document Summary",
      blocks: [
        { type: "heading", level: 1, text: "Introduction" },
        { type: "paragraph", text: "Hello World from Python!" }
      ]
    };

    const pythonCode = generatePythonScript(spec);
    expect(pythonCode).toContain("docx");

    const result = await executePythonCode(pythonCode);
    expect(result.success).toBe(true);
    expect(result.fileBuffer.length).toBeGreaterThan(0);
    // DOCX files are zip archives, magic bytes are PK
    expect(result.fileBuffer.subarray(0, 2).toString("utf-8")).toBe("PK");
  });

  it("generates valid Python code for xlsx and executes it", async () => {
    const spec: any = {
      format: "xlsx",
      filename: "test.xlsx",
      title: "Spreadsheet Title",
      sheets: [
        {
          name: "Sheet1",
          headers: ["Name", "Score"],
          rows: [
            ["Alice", "95"],
            ["Bob", "88"]
          ]
        }
      ]
    };

    const pythonCode = generatePythonScript(spec);
    expect(pythonCode).toContain("openpyxl");

    const result = await executePythonCode(pythonCode);
    expect(result.success).toBe(true);
    expect(result.fileBuffer.length).toBeGreaterThan(0);
    // XLSX files are also ZIP files
    expect(result.fileBuffer.subarray(0, 2).toString("utf-8")).toBe("PK");
  });

  it("generates valid Python code for pptx and executes it", async () => {
    const spec: any = {
      format: "pptx",
      filename: "test.pptx",
      title: "Presentation Title",
      slides: [
        {
          title: "Slide 1",
          layout: "title",
          bullets: ["Welcome to our deck"]
        }
      ]
    };

    const pythonCode = generatePythonScript(spec);
    expect(pythonCode).toContain("pptx");

    const result = await executePythonCode(pythonCode);
    expect(result.success).toBe(true);
    expect(result.fileBuffer.length).toBeGreaterThan(0);
    // PPTX files are also ZIP files
    expect(result.fileBuffer.subarray(0, 2).toString("utf-8")).toBe("PK");
  });

  it("generates valid Python code for pdf and executes it", async () => {
    const spec: any = {
      format: "pdf",
      filename: "test.pdf",
      title: "PDF Document",
      blocks: [
        { type: "heading", level: 1, text: "PDF Header" },
        { type: "paragraph", text: "A test paragraph in PDF." }
      ]
    };

    const pythonCode = generatePythonScript(spec);
    expect(pythonCode).toContain("reportlab");
    expect(pythonCode).not.toContain("#!/usr/bin/env");
    expect(pythonCode).toContain("File: test.pdf");
    expect(pythonCode).toContain("Title: PDF Document");
    expect(pythonCode).toContain('"test.pdf"');

    const result = await executePythonCode(pythonCode);
    expect(result.success).toBe(true);
    expect(result.fileBuffer.length).toBeGreaterThan(0);
    // PDF starts with %PDF
    expect(result.fileBuffer.subarray(0, 4).toString("utf-8")).toBe("%PDF");
  });

  it("omits shebang and synchronizes filename and title inside all generated Python scripts", () => {
    const formats = ["pdf", "docx", "xlsx", "pptx", "txt"] as const;
    for (const format of formats) {
      const code = generatePythonScript({
        format,
        filename: `Annual_Report.${format}`,
        title: "Annual Report",
        blocks: [{ type: "paragraph", text: "Summary text" }],
        sheets: [{ name: "Summary", rows: [["A", "B"]] }],
        slides: [{ title: "Annual Report", bullets: ["Point 1"] }],
      });

      // Shebang must never be generated
      expect(code).not.toContain("#!/usr/bin/env");

      // Filename and title must match and appear in code
      expect(code).toContain(`File: Annual_Report.${format}`);
      expect(code).toContain(`Annual_Report.${format}`);
    }
  });
});
