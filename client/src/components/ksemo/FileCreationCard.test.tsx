import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  FileCreationCard,
  getCreatingStatusPhrase,
  type FileCreationCardProps,
} from "./FileCreationCard";

function renderCard(props: FileCreationCardProps) {
  return renderToStaticMarkup(
    createElement(TooltipProvider, null, createElement(FileCreationCard, props))
  );
}

describe("FileCreationCard", () => {
  describe("In-Progress Creating State (Clean Minimal Shimmer Text, No Dropdown)", () => {
    it("renders without any boxed container, without dropdown chevron, without process list, and with continuous shimmer text", () => {
      const markup = renderCard({
        stage: "generating",
        format: "docx",
      });

      // Must render drafting test ID
      expect(markup).toContain('data-testid="file-creation-drafting"');

      // Must NOT contain old card box container or vertical line
      expect(markup).not.toContain("bg-card/60");
      expect(markup).not.toContain("rounded-xl border");
      expect(markup).not.toContain("border-destructive");
      expect(markup).not.toContain("border-l");

      // Per user request: no dropdown chevron and no process list dropdown
      expect(markup).not.toContain("lucide-chevron-down");
      expect(markup).not.toContain('data-testid="file-creation-process-list"');

      // Permanent status phrase with continuous left-to-right shimmer
      expect(markup).toContain("Creating document...");
      expect(markup).toContain("ksemo-shimmer-text");
    });

    it("displays permanent 2-word status phrases matching document format", () => {
      expect(getCreatingStatusPhrase("pdf")).toBe("Creating document...");
      expect(getCreatingStatusPhrase("docx")).toBe("Creating document...");
      expect(getCreatingStatusPhrase("xlsx")).toBe("Creating spreadsheet...");
      expect(getCreatingStatusPhrase("csv")).toBe("Creating spreadsheet...");
      expect(getCreatingStatusPhrase("pptx")).toBe("Creating presentation...");
      expect(getCreatingStatusPhrase("txt")).toBe("Creating text file...");

      const pdfMarkup = renderCard({
        stage: "analyzing",
        format: "pdf",
      });
      expect(pdfMarkup).toContain("Creating document...");

      const xlsxMarkup = renderCard({
        stage: "researching",
        format: "xlsx",
      });
      expect(xlsxMarkup).toContain("Creating spreadsheet...");

      const pptxMarkup = renderCard({
        stage: "designing",
        format: "pptx",
      });
      expect(pptxMarkup).toContain("Creating presentation...");
    });
  });

  describe("Completed State (Premium Document Preview Card)", () => {
    it("renders a large preview stage, filename row with Open on the right, and NO Download action", () => {
      const markup = renderCard({
        stage: "completed",
        format: "pdf",
        filename: "Quarterly_Report.pdf",
        fileUrl: "https://example.com/Quarterly_Report.pdf",
        fileSizeBytes: 245_760, // 240 KB
        metrics: { pages: 6, words: 1420 },
        initialShowReady: true,
      });

      expect(markup).toContain('data-testid="file-creation-completed"');
      expect(markup).toContain('data-testid="file-preview-stage"');
      expect(markup).toContain("Quarterly_Report.pdf");

      // File type is surfaced as plain metadata in the footer row
      expect(markup).toContain("PDF");

      // Preview action: hover reveals "Preview" with glassmorphic blur overlay,
      // clicking the preview area triggers open, while filename bar is static without Open button
      expect(markup).toContain("flex items-center justify-between gap-3");
      expect(markup).toContain("bg-gradient-to-t from-card");
      expect(markup).not.toContain("border-t");
      expect(markup).toContain('aria-label="Preview Quarterly_Report.pdf"');
      expect(markup).toContain('data-testid="file-preview-overlay"');
      expect(markup).toContain("Preview");
      expect(markup).toContain("lucide-eye");
      expect(markup).not.toContain("lucide-external-link");
      expect(markup).not.toContain("Open");
      expect(markup).not.toContain("Download");

      // Ready status indicator when freshly created
      expect(markup).toContain("Ready");

      // No ChatGPT-style message actions on the card
      expect(markup).not.toContain("Copy");
      expect(markup).not.toContain("Share");
      expect(markup).not.toContain(">Like");
      expect(markup).not.toContain("Regenerate");
      expect(markup).not.toContain("lucide-ellipsis");
      expect(markup).not.toContain("lucide-thumbs");

      // No legacy attachment-bubble styling (hover-only icon, tiny bubble)
      expect(markup).not.toContain("group-hover/file");
      expect(markup).not.toContain("group-hover/file:opacity-100");
      expect(markup).not.toContain("min-h-[58px]");

      // No size or page-count clutter on the card
      expect(markup).not.toContain("240 KB");
      expect(markup).not.toContain("6 pages");
      expect(markup).not.toContain("1,420 words");

      // No analysis panel or integrity badge on the card
      expect(markup).not.toContain("View analysis");
      expect(markup).not.toContain("Hide analysis");
      expect(markup).not.toContain("Integrity verified");
      expect(markup).not.toContain("Generation Pipeline Audit");
    });

    it("renders the preview card width contract (wide, not a giant or tiny container)", () => {
      const markup = renderCard({
        stage: "completed",
        format: "docx",
        filename: "Energy_Transition.docx",
        fileUrl: "https://example.com/Energy_Transition.docx",
      });

      expect(markup).toContain('data-testid="file-creation-completed"');
      expect(markup).toContain("max-w-[480px]");
      expect(markup).toContain("rounded-2xl");
      expect(markup).not.toContain("w-fit");
      expect(markup).not.toContain("min-w-[220px]");
    });

    it("does not render source chips in the card UI (sources stay embedded inside the generated file)", () => {
      const sources = [
        {
          title: "Global Energy Outlook 2026",
          url: "https://iea.org/reports/outlook-2026",
          publisher: "iea.org",
        },
        {
          title: "Renewable Energy Transition",
          url: "https://nature.com/articles/renewable-energy",
          publisher: "nature.com",
        },
      ];

      const markup = renderCard({
        stage: "completed",
        format: "docx",
        filename: "Energy_Transition.docx",
        fileUrl: "https://example.com/Energy_Transition.docx",
        fileSizeBytes: 102_400,
        sources,
        metrics: { words: 850 },
      });

      // Sources must NOT be rendered as UI chips in the card (they are embedded in the doc)
      expect(markup).not.toContain("Referenced Sources");
      expect(markup).not.toContain("iea.org");
      expect(markup).not.toContain("nature.com");
    });

    it("does not show 'Ready' indicator when opening a completed file from history (initialShowReady is false by default)", () => {
      const markup = renderCard({
        stage: "completed",
        format: "pdf",
        filename: "Quarterly_Report.pdf",
        fileUrl: "https://example.com/Quarterly_Report.pdf",
      });

      expect(markup).toContain('data-testid="file-creation-completed"');
      expect(markup).toContain("Quarterly_Report.pdf");
      // Must NOT contain Ready when loaded from history
      expect(markup).not.toContain("Ready");
    });
  });

  describe("Error State", () => {
    it("renders friendly error message and retry button when onRetry provided", () => {
      const onRetry = vi.fn();
      const markup = renderCard({
        stage: "error",
        format: "xlsx",
        onRetry,
      });

      expect(markup).toContain("Document creation could not be completed");
      expect(markup).toContain("Try again");
    });
  });

  describe("Interrupted State", () => {
    it("renders a clean stopped card with retry when onRetry provided", () => {
      const onRetry = vi.fn();
      const markup = renderCard({
        stage: "interrupted",
        format: "docx",
        onRetry,
      });

      expect(markup).toContain("Document creation was stopped");
      expect(markup).toContain("Try again");
      expect(markup).not.toContain('data-testid="file-creation-drafting"');
      expect(markup).not.toContain('data-testid="file-creation-completed"');
    });
  });

  describe("Python Code Inspection", () => {
    it("renders file container and code container with identical h-[302px] height, matching subtle blur, and Show Code", () => {
      const markup = renderCard({
        stage: "completed",
        format: "pdf",
        filename: "report.pdf",
        fileUrl: "https://example.com/report.pdf",
        code: "#!/usr/bin/env python3\nimport reportlab\nprint('Generated PDF')",
      });

      // Layout: file card original width + code container with small two-lines gap
      expect(markup).toContain("flex flex-col md:flex-row items-stretch gap-1 sm:gap-1.5");
      expect(markup).toContain('data-testid="file-creation-completed"');
      expect(markup).toContain("md:w-[460px]");
      expect(markup).toContain("h-[302px]");
      expect(markup).toContain('data-testid="file-code-container"');

      // Both file card and code container have identical height (h-[302px])
      const matchHeights = markup.match(/h-\[302px\]/g);
      expect(matchHeights?.length).toBeGreaterThanOrEqual(2);

      // Left container: document preview with hover Preview overlay, title, NO Open button
      expect(markup).toContain("report.pdf");
      expect(markup).toContain("PDF");
      expect(markup).toContain('data-testid="file-preview-overlay"');
      expect(markup).toContain("Preview");
      expect(markup).toContain("lucide-eye");
      expect(markup).not.toContain("lucide-external-link");
      expect(markup).not.toContain("Open");

      // Right container: sidebar theme color, CodeSurface code preview, Show Code on hover, no outside Python tag, no green colors, NO tooltip title
      expect(markup).toContain("bg-sidebar");
      expect(markup).toContain("import reportlab");
      expect(markup).toContain("ksemo-code-body");
      expect(markup).toContain("Show Code");
      expect(markup).not.toContain('title="Click to view code"');
      expect(markup).not.toContain("text-emerald-400");
      expect(markup).not.toContain("text-emerald-500");

      // Strips shebang from code block
      expect(markup).not.toContain("#!/usr/bin/env");

      // Matching subtle blur effect on both containers
      expect(markup).toContain("backdrop-blur-[1px]");
    });

    it("unifies code opening with the document viewer (exact same opening mechanism as file)", () => {
      const markup = renderCard({
        stage: "completed",
        format: "pdf",
        filename: "report.pdf",
        fileUrl: "https://example.com/report.pdf",
        code: "#!/usr/bin/env python3\nimport reportlab\nprint('Generated PDF')",
        initialShowCodeDrawer: true,
      });

      // Unified experience: no separate standalone modal or inline clutter
      expect(markup).not.toContain('data-testid="file-code-studio"');
      expect(markup).not.toContain('data-testid="file-code-modal"');
      expect(markup).not.toContain('data-testid="file-code-expanded"');

      // Both containers present side-by-side with exact same height
      expect(markup).toContain('data-testid="file-preview-stage"');
      expect(markup).toContain('data-testid="file-code-container"');
      expect(markup).toContain("Show Code");

      // Verify preview icon is distinct from external-link
      expect(markup).toContain("lucide-eye");
      expect(markup).not.toContain("lucide-external-link");

      // Strips shebang
      expect(markup).not.toContain("#!/usr/bin/env");
    });

    it("renders distinct responsive code containers for desktop (side-by-side) and mobile (compact touch card)", () => {
      const markup = renderCard({
        stage: "completed",
        format: "pdf",
        filename: "report.pdf",
        fileUrl: "https://example.com/report.pdf",
        code: "import reportlab\nprint('Generated PDF')",
      });

      // Desktop container: hidden on mobile, flex on md+
      expect(markup).toContain('data-testid="file-code-container"');
      expect(markup).toContain("hidden md:flex");

      // Mobile container: flex on mobile, hidden on md+
      expect(markup).toContain('data-testid="file-code-container-mobile"');
      expect(markup).toContain("flex md:hidden");
      expect(markup).toContain("report.py");
      expect(markup).toContain("Python code");
      expect(markup).toContain("Show Code");
    });
  });
});

import { splitFirstSentence } from "./MessageContent";

describe("splitFirstSentence (Message Content Formatting)", () => {
  it("splits multi-paragraph content into first sentence and remaining response", () => {
    const content = `I've created your comprehensive PDF document on "Clean Energy Trends".\n\n### Key Highlights\n- Solar power increased by 30%\n- Wind power investments reached record highs.`;
    const result = splitFirstSentence(content);
    expect(result.first).toBe(
      `I've created your comprehensive PDF document on "Clean Energy Trends".`
    );
    expect(result.rest).toBe(
      `### Key Highlights\n- Solar power increased by 30%\n- Wind power investments reached record highs.`
    );
  });

  it("splits single-line multi-sentence content into first sentence and remaining details", () => {
    const content = `I have generated your financial spreadsheet. The document includes 3 sheets with complete budget breakdowns.`;
    const result = splitFirstSentence(content);
    expect(result.first).toBe(`I have generated your financial spreadsheet.`);
    expect(result.rest).toBe(
      `The document includes 3 sheets with complete budget breakdowns.`
    );
  });

  it("returns entire text as first when only a single sentence is provided", () => {
    const content = `I've prepared your comprehensive Word document on Machine Learning with full sections and references.`;
    const result = splitFirstSentence(content);
    expect(result.first).toBe(content);
    expect(result.rest).toBe("");
  });

  it("handles empty or whitespace-only content gracefully", () => {
    const result = splitFirstSentence("   ");
    expect(result.first).toBe("");
    expect(result.rest).toBe("");
  });
});
