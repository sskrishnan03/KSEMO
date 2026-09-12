import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PdfDrawer, ExcelViewer } from "./PdfDrawer";
import {
  PdfViewerProvider,
  isExcel,
  isPdf,
  isPowerPoint,
  isText,
  isViewableDocument,
  isWord,
} from "@/contexts/PdfViewerContext";

function TestDrawerWithFile({
  file,
  openImmediately = true,
}: {
  file: { url: string; filename: string; sizeBytes?: number; mimeType?: string } | null;
  openImmediately?: boolean;
}) {
  return createElement(
    TooltipProvider,
    null,
    createElement(
      PdfViewerProvider,
      {
        initialPdf: file,
        initialOpen: openImmediately,
      },
      createElement(PdfDrawer)
    )
  );
}

describe("PdfDrawer", () => {
  it("renders nothing when closed or without PDF file", () => {
    const markup = renderToStaticMarkup(
      createElement(
        TooltipProvider,
        null,
        createElement(PdfViewerProvider, null, createElement(PdfDrawer))
      )
    );
    expect(markup).toBe("");
  });

  it("renders drawer with clean filename on the left, and download icon and cancel icon on the right for PDF", () => {
    const markup = renderToStaticMarkup(
      createElement(TestDrawerWithFile, {
        file: {
          url: "/api/files/annual-report.pdf",
          filename: "annual-report.pdf",
          sizeBytes: 1048576, // 1 MB
        },
        openImmediately: true,
      })
    );

    // Verifies dialog container and test id
    expect(markup).toContain('data-testid="pdf-drawer"');
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain("Document Viewer: annual-report.pdf");

    // Left side: verifies filename is present
    expect(markup).toContain('data-testid="pdf-drawer-filename"');
    expect(markup).toContain("annual-report.pdf");

    // Verifies that document size and subtitle are NOT shown
    expect(markup).not.toContain("PDF Document");
    expect(markup).not.toContain("1.00 MB");
    expect(markup).not.toContain("1.0 MB");

    // Right side: verifies top dropdown was removed as requested
    expect(markup).not.toContain('data-testid="pdf-drawer-zoom-dropdown"');

    // Right side: verifies download icon button exists
    expect(markup).toContain('data-testid="pdf-drawer-download-btn"');

    // Right side: verifies cancel icon button exists
    expect(markup).toContain('data-testid="pdf-drawer-close-btn"');

    // Verifies that browser system iframe is NOT used
    expect(markup).not.toContain("<iframe");
  });

  it("renders drawer with clean filename and controls for Word (.docx) document", () => {
    const markup = renderToStaticMarkup(
      createElement(TestDrawerWithFile, {
        file: {
          url: "/api/files/Research-Proposal.docx",
          filename: "Research-Proposal.docx",
          sizeBytes: 524288,
        },
        openImmediately: true,
      })
    );

    expect(markup).toContain('data-testid="pdf-drawer"');
    expect(markup).toContain("Document Viewer: Research-Proposal.docx");
    expect(markup).toContain('data-testid="pdf-drawer-filename"');
    expect(markup).toContain("Research-Proposal.docx");
    expect(markup).toContain('data-testid="pdf-drawer-download-btn"');
    expect(markup).toContain('data-testid="pdf-drawer-close-btn"');
    expect(markup).not.toContain("<iframe");
  });

  it("renders drawer with clean filename and controls for Excel (.xlsx) spreadsheet", () => {
    const markup = renderToStaticMarkup(
      createElement(TestDrawerWithFile, {
        file: {
          url: "/api/files/Financial-Model.xlsx",
          filename: "Financial-Model.xlsx",
          sizeBytes: 65536,
        },
        openImmediately: true,
      })
    );

    expect(markup).toContain('data-testid="pdf-drawer"');
    expect(markup).toContain("Document Viewer: Financial-Model.xlsx");
    expect(markup).toContain('data-testid="pdf-drawer-filename"');
    expect(markup).toContain("Financial-Model.xlsx");
    expect(markup).toContain('data-testid="pdf-drawer-download-btn"');
    expect(markup).toContain('data-testid="pdf-drawer-close-btn"');
    expect(markup).not.toContain("<iframe");
  });

  it("renders ExcelViewer edge-to-edge with formula bar, add row/col, undo/redo, minimum 50x50 grid, drag-to-copy handle, and renamable sheet tabs", () => {
    const sheets = [
      {
        name: "Financials",
        data: [
          ["Q1", "Q2", "Q3", "Q4"],
          [100, 200, 300, 400],
        ],
      },
      {
        name: "Summary",
        data: [["Total", 1000]],
      },
    ];

    const markup = renderToStaticMarkup(
      createElement(
        TooltipProvider,
        null,
        createElement(ExcelViewer, {
          sheets,
          scale: 1.0,
        })
      )
    );

    // Edge-to-edge layout: no container card rounded-xl or shadow-2xl
    expect(markup).toContain('data-testid="excel-document-viewer"');
    expect(markup).not.toContain("rounded-xl");
    expect(markup).not.toContain("shadow-2xl");

    // Formula bar with coordinate fallback and no pre-selected cell (no fx glyph)
    expect(markup).toContain("A1");
    expect(markup).toContain("Click any cell to edit");
    expect(markup).not.toContain("fx");

    // Add row / add column quick controls exist
    expect(markup).toContain("+ Row");
    expect(markup).toContain("+ Col");

    // Undo / Redo controls exist
    expect(markup).toContain('aria-label="Undo"');
    expect(markup).toContain('aria-label="Redo"');

    // No status bar (no Ready / rows / cols summary) and no add-sheet button
    expect(markup).not.toContain("Ready");
    expect(markup).not.toContain("Add new sheet");

    // Grid renders sheet tabs, actual data, and minimum 50x50 grid
    expect(markup).toContain("Financials");
    expect(markup).toContain("Summary");
    expect(markup).toContain("Q1");
    expect(markup).toContain("100");
    expect(markup).toContain('data-row="49"');
  });

  it("renders drawer with clean filename and controls for PowerPoint (.pptx) presentation", () => {
    const markup = renderToStaticMarkup(
      createElement(TestDrawerWithFile, {
        file: {
          url: "/api/files/Investor-Pitch.pptx",
          filename: "Investor-Pitch.pptx",
          sizeBytes: 1048576,
        },
        openImmediately: true,
      })
    );

    expect(markup).toContain('data-testid="pdf-drawer"');
    expect(markup).toContain("Document Viewer: Investor-Pitch.pptx");
    expect(markup).toContain('data-testid="pdf-drawer-filename"');
    expect(markup).toContain("Investor-Pitch.pptx");
    expect(markup).toContain('data-testid="pdf-drawer-download-btn"');
    expect(markup).toContain('data-testid="pdf-drawer-close-btn"');
    expect(markup).not.toContain("<iframe");
  });

  it("renders drawer with clean filename and controls for Text (.txt, .md) document", () => {
    const markup = renderToStaticMarkup(
      createElement(TestDrawerWithFile, {
        file: {
          url: "/api/files/system-notes.txt",
          filename: "system-notes.txt",
        },
        openImmediately: true,
      })
    );

    expect(markup).toContain('data-testid="pdf-drawer"');
    expect(markup).toContain("Document Viewer: system-notes.txt");
    expect(markup).toContain('data-testid="pdf-drawer-filename"');
    expect(markup).toContain("system-notes.txt");
    expect(markup).toContain('data-testid="pdf-drawer-download-btn"');
    expect(markup).toContain('data-testid="pdf-drawer-close-btn"');
    expect(markup).not.toContain("<iframe");
  });

  describe("Document type helpers", () => {
    it("isPdf identifies PDF filenames and mimeTypes", () => {
      expect(isPdf("document.pdf")).toBe(true);
      expect(isPdf("PROJECT-BRIEF.PDF")).toBe(true);
      expect(isPdf("archive.pdf.txt")).toBe(false);
      expect(isPdf("image.png")).toBe(false);
      expect(isPdf(undefined)).toBe(false);
      expect(isPdf("document", "application/pdf")).toBe(true);
      expect(isPdf(undefined, "application/pdf")).toBe(true);
    });

    it("isWord identifies Word documents", () => {
      expect(isWord("Contract.docx")).toBe(true);
      expect(isWord("Proposal.DOCX")).toBe(true);
      expect(isWord("legacy.doc")).toBe(true);
      expect(isWord("document.pdf")).toBe(false);
      expect(isWord("notes.txt")).toBe(false);
      expect(
        isWord(
          undefined,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
      ).toBe(true);
    });

    it("isExcel identifies Excel and spreadsheet documents", () => {
      expect(isExcel("financials.xlsx")).toBe(true);
      expect(isExcel("BUDGET.XLSX")).toBe(true);
      expect(isExcel("legacy.xls")).toBe(true);
      expect(isExcel("table.csv")).toBe(true);
      expect(isExcel("data.tsv")).toBe(true);
      expect(isExcel("document.pdf")).toBe(false);
      expect(isExcel("Contract.docx")).toBe(false);
      expect(
        isExcel(
          undefined,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
      ).toBe(true);
      expect(isExcel(undefined, "text/csv")).toBe(true);
    });

    it("isPowerPoint identifies PowerPoint presentation documents", () => {
      expect(isPowerPoint("presentation.pptx")).toBe(true);
      expect(isPowerPoint("PITCH.PPTX")).toBe(true);
      expect(isPowerPoint("legacy.ppt")).toBe(true);
      expect(isPowerPoint("document.pdf")).toBe(false);
      expect(isPowerPoint("financials.xlsx")).toBe(false);
      expect(
        isPowerPoint(
          undefined,
          "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        )
      ).toBe(true);
    });

    it("isText identifies text documents", () => {
      expect(isText("readme.md")).toBe(true);
      expect(isText("data.json")).toBe(true);
      expect(isText("notes.txt")).toBe(true);
      expect(isText("config.yaml")).toBe(true);
      expect(isText("script.py")).toBe(true);
      expect(isText("document.pdf")).toBe(false);
      expect(isText("Contract.docx")).toBe(false);
      expect(isText("sheet.xlsx")).toBe(false);
      expect(isText(undefined, "text/plain")).toBe(true);
      expect(isText(undefined, "application/json")).toBe(true);
    });

    it("isViewableDocument identifies PDF, Word, Excel, PowerPoint, and Text documents", () => {
      expect(isViewableDocument("doc.pdf")).toBe(true);
      expect(isViewableDocument("doc.docx")).toBe(true);
      expect(isViewableDocument("budget.xlsx")).toBe(true);
      expect(isViewableDocument("deck.pptx")).toBe(true);
      expect(isViewableDocument("doc.txt")).toBe(true);
      expect(isViewableDocument("app.zip")).toBe(false);
      expect(isViewableDocument("photo.jpg")).toBe(false);
    });
  });
});
