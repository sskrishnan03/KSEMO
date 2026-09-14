import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  FileCreationCard,
  type FileCreationCardProps,
} from "./FileCreationCard";

function renderCard(props: FileCreationCardProps) {
  return renderToStaticMarkup(
    createElement(TooltipProvider, null, createElement(FileCreationCard, props))
  );
}

describe("FileCreationCard", () => {
  describe("In-Progress Creating State (Container-Free & Live Milestone Paced)", () => {
    it("renders without any boxed container, without Details/Hide text, without vertical border lines, and with single concise status phrase", () => {
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

      // Per user request: no "Details" or "Hide" words
      expect(markup).not.toContain("Details");
      expect(markup).not.toContain("Hide");

      // Displays single concise live status phrase directly from real backend stage
      expect(markup).toContain("Compiling the file");

      // Displays toggle chevron
      expect(markup).toContain("lucide-chevron-down");
    });

    it("displays stage-specific single concise status phrases matching the backend pipeline", () => {
      const analyzingMarkup = renderCard({
        stage: "analyzing",
        format: "pdf",
      });
      expect(analyzingMarkup).toContain("Crafting the intelligence");

      const planningMarkup = renderCard({
        stage: "planning",
        format: "pdf",
      });
      expect(planningMarkup).toContain("Structuring the content");

      const researchingMarkup = renderCard({
        stage: "researching",
        format: "pdf",
      });
      expect(researchingMarkup).toContain("Gathering verified insights");

      const writingDocMarkup = renderCard({
        stage: "content_generated",
        format: "pdf",
      });
      expect(writingDocMarkup).toContain("Writing the document");

      const writingSheetMarkup = renderCard({
        stage: "content_generated",
        format: "xlsx",
      });
      expect(writingSheetMarkup).toContain("Writing the spreadsheet");

      const designingMarkup = renderCard({
        stage: "designing",
        format: "docx",
      });
      expect(designingMarkup).toContain("Formatting the layout");

      const validatingMarkup = renderCard({
        stage: "validating",
        format: "pdf",
      });
      expect(validatingMarkup).toContain("Validating document integrity");
    });

    it("renders stage-specific icons before each step label inside the expanded process dropdown", () => {
      const docxMarkup = renderCard({
        stage: "generating",
        format: "docx",
        defaultExpanded: true,
        researchSourceCount: 3,
      });

      // Must render process list
      expect(docxMarkup).toContain('data-testid="file-creation-process-list"');

      // Check each step's icon (lucide icons generate class names like lucide-sparkles, etc.)
      expect(docxMarkup).toContain("lucide-sparkles");
      expect(docxMarkup).toContain("Analyzing the request");

      expect(docxMarkup).toContain("lucide-globe");
      expect(docxMarkup).toContain("Gathering verified research (3 sources)");

      expect(docxMarkup).toContain("lucide-layout-list");
      expect(docxMarkup).toContain("Structuring the content");

      expect(docxMarkup).toContain("lucide-pen-line");
      expect(docxMarkup).toContain("Writing the document");

      expect(docxMarkup).toContain("lucide-palette");
      expect(docxMarkup).toContain("Formatting the layout");

      expect(docxMarkup).toContain("lucide-cpu");
      expect(docxMarkup).toContain("Compiling the file");

      expect(docxMarkup).toContain("lucide-shield-check");
      expect(docxMarkup).toContain("Validating document integrity");
    });

    it("renders format-tailored icons for spreadsheet and presentation steps", () => {
      const xlsxMarkup = renderCard({
        stage: "content_generated",
        format: "xlsx",
        defaultExpanded: true,
      });
      expect(xlsxMarkup).toContain("lucide-table");
      expect(xlsxMarkup).toContain("Writing the spreadsheet");

      const pptxMarkup = renderCard({
        stage: "content_generated",
        format: "pptx",
        defaultExpanded: true,
      });
      expect(pptxMarkup).toContain("lucide-presentation");
      expect(pptxMarkup).toContain("Writing the presentation");
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

      // Single action: Open sits next to the filename in a footer BELOW the
      // preview (preview content on top), blended in by a fade (no hard line),
      // and there is no Download action at all
      expect(markup).toContain("flex items-center justify-between gap-3");
      expect(markup).toContain("bg-gradient-to-t from-card");
      expect(markup).not.toContain("border-t");
      expect(markup).toContain('aria-label="Open Quarterly_Report.pdf"');
      expect(markup).toContain("Open");
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
      expect(markup).not.toContain("opacity-0 transition-opacity");
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
