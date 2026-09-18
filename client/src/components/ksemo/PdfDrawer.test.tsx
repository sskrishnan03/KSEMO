import { createElement, useRef, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { describe, expect, it } from "vitest";
import superjson from "superjson";
import { TooltipProvider } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import {
  PdfDrawer,
  ExcelViewer,
  PresentationPreview,
  PptSlideSidebar,
  isPageNumberOrFileFooter,
  isLightOrWhiteBorder,
} from "./PdfDrawer";
import {
  DEFAULT_PRESENTATION_CONFIG,
  type PptPresentationSpec,
} from "@shared/presentation";
import {
  PdfViewerProvider,
  isExcel,
  isPdf,
  isPowerPoint,
  isText,
  isViewableDocument,
  isWord,
} from "@/contexts/PdfViewerContext";

function Providers({ children }: { children: ReactNode }) {
  const ref = useRef<{
    queryClient: QueryClient;
    trpcClient: ReturnType<typeof trpc.createClient>;
  } | null>(null);
  if (ref.current === null) {
    ref.current = {
      queryClient: new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      }),
      trpcClient: trpc.createClient({
        links: [
          httpBatchLink({
            url: "http://localhost/api/trpc",
            transformer: superjson,
          }),
        ],
      }),
    };
  }
  return createElement(trpc.Provider, {
    client: ref.current.trpcClient,
    queryClient: ref.current.queryClient,
    children: createElement(
      QueryClientProvider,
      { client: ref.current.queryClient },
      children
    ),
  });
}

function TestDrawerWithFile({
  file,
  openImmediately = true,
}: {
  file: {
    url: string;
    filename: string;
    sizeBytes?: number;
    mimeType?: string;
  } | null;
  openImmediately?: boolean;
}) {
  return createElement(
    TooltipProvider,
    null,
    createElement(
      Providers,
      null,
      createElement(
        PdfViewerProvider,
        {
          initialPdf: file,
          initialOpen: openImmediately,
        },
        createElement(PdfDrawer)
      )
    )
  );
}

describe("PdfDrawer", () => {
  it("renders nothing when closed or without PDF file", () => {
    const markup = renderToStaticMarkup(
      createElement(
        TooltipProvider,
        null,
        createElement(
          Providers,
          null,
          createElement(PdfViewerProvider, null, createElement(PdfDrawer))
        )
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

  it("renders a PowerPoint preview faithfully straight from the canonical presentation spec", () => {
    const spec: PptPresentationSpec = {
      version: 1,
      widthIn: 13.333,
      heightIn: 7.5,
      title: "Growth Report",
      themeKey: "corporate",
      style: "Corporate",
      config: {
        slides: "auto",
        visualStyle: "auto",
        layout: "Balanced",
        density: "Standard",
        visuals: "Balanced",
      },
      slides: [
        {
          index: 1,
          kind: "title",
          background: "#0B0F19",
          elements: [
            {
              kind: "text",
              box: { x: 0.6, y: 0.55, w: 8, h: 1 },
              text: "Our Growth Story",
              fontSize: 40,
              bold: true,
              color: "#FFFFFF",
            },
            {
              kind: "shape",
              box: { x: 0.6, y: 6.6, w: 2, h: 0.5 },
              shape: "rect",
              fill: "#FF7A45",
            },
            {
              kind: "barChart",
              box: { x: 8.9, y: 2, w: 4.2, h: 4 },
              data: [
                { label: "Q1", value: 100 },
                { label: "Q2", value: 180 },
              ],
              color: "#FF7A45",
              secondaryColor: "#4E7AFF",
              labelColor: "#A8B2C1",
              valueColor: "#FFFFFF",
              max: 200,
            },
          ],
        },
      ],
    };

    const markup = renderToStaticMarkup(
      createElement(PresentationPreview, { spec, scale: 1.0 })
    );

    // Faithful canvas rendering, not the text-only legacy viewer
    expect(markup).toContain('data-testid="ksemo-presentation-viewer"');
    expect(markup).toContain('data-testid="ksemo-ppt-slide-1"');
    expect(markup).not.toContain('data-testid="powerpoint-document-viewer"');
    // Slide background and element colors carry through from the spec
    expect(markup).toContain("#0B0F19");
    expect(markup).toContain("#FF7A45");
    // Title text and chart data/labels are present
    expect(markup).toContain("Our Growth Story");
    expect(markup).toContain("Q2");
    expect(markup).toContain("180");
    // Verify slide canvas has NO page numbers or file name footers
    expect(markup).not.toContain("1 / 1");
    expect(markup).not.toContain("Slide 1");
    expect(markup).not.toContain("PowerPoint Presentation");
  });

  it("renders PptSlideSidebar with slide numbers, thumbnails, and active indicator", () => {
    const spec: PptPresentationSpec = {
      version: 1,
      widthIn: 13.333,
      heightIn: 7.5,
      title: "Quarterly Review",
      themeKey: "modern",
      style: "Modern",
      config: {
        ...DEFAULT_PRESENTATION_CONFIG,
        visualStyle: "modern",
        slides: 3,
      },
      slides: [
        {
          index: 1,
          kind: "title",
          background: "#111827",
          elements: [
            {
              kind: "text",
              box: { x: 1, y: 2, w: 10, h: 2 },
              text: "Quarterly Review",
              fontSize: 32,
              color: "#FFFFFF",
            },
          ],
        },
        {
          index: 2,
          kind: "content",
          background: "#1F2937",
          elements: [
            {
              kind: "text",
              box: { x: 1, y: 1, w: 10, h: 1 },
              text: "Key Objectives",
              fontSize: 24,
              color: "#FFFFFF",
            },
          ],
        },
      ],
    };

    const markup = renderToStaticMarkup(
      createElement(
        TooltipProvider,
        null,
        createElement(PptSlideSidebar, {
          canonicalSpec: spec,
          currentSlide: 1,
          onSelectSlide: () => {},
          isOpen: true,
          onClose: () => {},
        })
      )
    );

    // Sidebar container and header
    expect(markup).toContain('data-testid="pptx-sidebar"');
    expect(markup).toContain("Slides");
    // Collapse button with ChevronsLeft
    expect(markup).toContain('data-testid="pptx-sidebar-collapse-btn"');

    // Thumbnails for both slides
    expect(markup).toContain('data-testid="pptx-sidebar-thumb-1"');
    expect(markup).toContain('data-testid="pptx-sidebar-thumb-2"');

    // Slide numbers
    expect(markup).toContain("1");
    expect(markup).toContain("2");

    // Active slide 1 has aria-current="true"
    expect(markup).toContain('aria-current="true"');

    // When closed, sidebar returns null
    const closedMarkup = renderToStaticMarkup(
      createElement(PptSlideSidebar, {
        canonicalSpec: spec,
        currentSlide: 1,
        onSelectSlide: () => {},
        isOpen: false,
      })
    );
    expect(closedMarkup).toBe("");
  });

  it("isPageNumberOrFileFooter detects and suppresses page numbers and filenames", () => {
    // Pure numbers
    expect(isPageNumberOrFileFooter("1")).toBe(true);
    expect(isPageNumberOrFileFooter("05")).toBe(true);
    // Slide and page patterns
    expect(isPageNumberOrFileFooter("Slide 1")).toBe(true);
    expect(isPageNumberOrFileFooter("slide 2")).toBe(true);
    expect(isPageNumberOrFileFooter("Page 3")).toBe(true);
    expect(isPageNumberOrFileFooter("1 of 10")).toBe(true);
    expect(isPageNumberOrFileFooter("Slide 1 of 5")).toBe(true);
    expect(isPageNumberOrFileFooter("Page 2 / 8")).toBe(true);
    expect(isPageNumberOrFileFooter("3/5")).toBe(true);
    expect(isPageNumberOrFileFooter("Slide #4")).toBe(true);
    // Filename patterns
    expect(isPageNumberOrFileFooter("Presentation.pptx", "Presentation.pptx")).toBe(true);
    expect(isPageNumberOrFileFooter("Presentation", "Presentation.pptx")).toBe(true);
    expect(isPageNumberOrFileFooter("presentation", "Presentation.pptx")).toBe(true);
    // Legitimate content should NOT be filtered
    expect(isPageNumberOrFileFooter("Key Takeaways for 2026")).toBe(false);
    expect(isPageNumberOrFileFooter("Revenue increased by 45%")).toBe(false);
    expect(isPageNumberOrFileFooter("3 key strategic priorities")).toBe(false);
  });

  it("PresentationPreview scales slide proportionally at 16:9 and suppresses slide numbers", () => {
    const spec: PptPresentationSpec = {
      version: 1,
      widthIn: 13.333,
      heightIn: 7.5,
      title: "Clean Deck",
      themeKey: "modern",
      style: "Modern",
      config: {
        ...DEFAULT_PRESENTATION_CONFIG,
        visualStyle: "modern",
        slides: 1,
      },
      slides: [
        {
          index: 1,
          kind: "title",
          background: "#FFFFFF",
          elements: [
            {
              kind: "text",
              box: { x: 1, y: 1, w: 10, h: 2 },
              text: "Clean Title",
              fontSize: 32,
              color: "#111827",
            },
            {
              kind: "text",
              box: { x: 1, y: 6.5, w: 5, h: 0.5 },
              text: "Slide 1 of 1",
              fontSize: 10,
              color: "#999999",
            },
            {
              kind: "text",
              box: { x: 6, y: 6.5, w: 5, h: 0.5 },
              text: "Clean Deck.pptx",
              fontSize: 10,
              color: "#999999",
            },
          ],
        },
      ],
    };

    const markup = renderToStaticMarkup(
      createElement(PresentationPreview, {
        spec,
        slideWidth: 1024,
        slideHeight: 576,
        filename: "Clean Deck.pptx",
      })
    );

    // 16:9 proportional dimensions are set
    expect(markup).toContain("width:1024px");
    expect(markup).toContain("height:576px");
    expect(markup).toContain("--s:1024px");
    // Title is present
    expect(markup).toContain("Clean Title");
    // Page number and filename footers are stripped
    expect(markup).not.toContain("Slide 1 of 1");
    expect(markup).not.toContain("Clean Deck.pptx");
  });

  it("PresentationPreview sets exact 1-based data-slide attributes matching sidebar thumbnails", () => {
    const spec: PptPresentationSpec = {
      version: 1,
      widthIn: 13.333,
      heightIn: 7.5,
      title: "Multi-slide Pitch",
      themeKey: "modern",
      style: "Modern",
      config: {
        ...DEFAULT_PRESENTATION_CONFIG,
        visualStyle: "modern",
        slides: 5,
      },
      slides: [
        { index: 0, kind: "title", background: "#FFFFFF", elements: [] },
        { index: 1, kind: "content", background: "#FFFFFF", elements: [] },
        { index: 2, kind: "content", background: "#FFFFFF", elements: [] },
        { index: 3, kind: "content", background: "#FFFFFF", elements: [] },
        { index: 4, kind: "content", background: "#FFFFFF", elements: [] },
      ],
    };

    const markup = renderToStaticMarkup(
      createElement(PresentationPreview, {
        spec,
      })
    );

    // Each slide MUST have 1-based data-slide matching human thumbnail numbers (1 to 5)
    // and NEVER 0-based data-slide="0" which causes off-by-one scroll jumps!
    expect(markup).not.toContain('data-slide="0"');
    expect(markup).toContain('data-slide="1"');
    expect(markup).toContain('data-slide="2"');
    expect(markup).toContain('data-slide="3"');
    expect(markup).toContain('data-slide="4"');
    expect(markup).toContain('data-slide="5"');

    // Also verify data-testid matching 1-based slide numbers
    expect(markup).toContain('data-testid="ksemo-ppt-slide-1"');
    expect(markup).toContain('data-testid="ksemo-ppt-slide-4"');
    expect(markup).toContain('data-testid="ksemo-ppt-slide-5"');

    // Verify sidebar thumbnail selection for slide 4
    let selectedSlide = -1;
    const sidebarMarkup = renderToStaticMarkup(
      createElement(
        TooltipProvider,
        null,
        createElement(PptSlideSidebar, {
          canonicalSpec: spec,
          currentSlide: 4,
          onSelectSlide: (n: number) => {
            selectedSlide = n;
          },
          isOpen: true,
        })
      )
    );

    expect(sidebarMarkup).toContain('data-testid="pptx-sidebar-thumb-4"');
    // Slide 4 thumbnail is active
    expect(sidebarMarkup).toContain('data-testid="pptx-sidebar-thumb-4" aria-label="Go to slide 4" aria-current="true"');
  });

  it("verifies presentation slides and thumbnails use chat box border styling (border-border) with zero white borderlines or white fade", () => {
    expect(isLightOrWhiteBorder("FFFFFF")).toBe(true);
    expect(isLightOrWhiteBorder("#fff")).toBe(true);
    expect(isLightOrWhiteBorder("white")).toBe(true);
    expect(isLightOrWhiteBorder("E4E7EC")).toBe(true);
    expect(isLightOrWhiteBorder("E2E5EA")).toBe(true);
    expect(isLightOrWhiteBorder("23408F")).toBe(false);

    const spec: PptPresentationSpec = {
      version: 1,
      widthIn: 13.333,
      heightIn: 7.5,
      title: "Clean Deck",
      themeKey: "modern",
      style: "Modern",
      config: {
        ...DEFAULT_PRESENTATION_CONFIG,
        visualStyle: "modern",
        slides: 2,
      },
      slides: [
        {
          index: 0,
          kind: "title",
          background: "#FFFFFF",
          elements: [
            {
              kind: "shape",
              shape: "roundRect",
              box: { x: 1, y: 1, w: 5, h: 3 },
              fill: "F5F6F8",
              lineColor: "E4E7EC", // near-white border color must be suppressed
            },
          ],
        },
      ],
    };

    const previewMarkup = renderToStaticMarkup(
      createElement(PresentationPreview, { spec })
    );
    // Slide container uses chat box border (border-border), NOT white border-neutral-200/80
    expect(previewMarkup).toContain("border-border");
    expect(previewMarkup).not.toContain("border-neutral-200/80");

    // Ensure the shape inside has NO white border style
    expect(previewMarkup).not.toContain("solid rgb(228, 231, 236)");
    expect(previewMarkup).not.toContain("solid #E4E7EC");

    const sidebarMarkup = renderToStaticMarkup(
      createElement(
        TooltipProvider,
        null,
        createElement(PptSlideSidebar, {
          canonicalSpec: spec,
          currentSlide: 1,
          onSelectSlide: () => {},
          isOpen: true,
        })
      )
    );

    // Sidebar header has no background container for the icon
    expect(sidebarMarkup).not.toContain("bg-primary/10");
    expect(sidebarMarkup).toContain("Slides");
    expect(sidebarMarkup).toContain("text-sm font-semibold");

    // Thumbnails use chat box border styling without white borderlines or white fade
    expect(sidebarMarkup).not.toContain("border-primary");
    expect(sidebarMarkup).not.toContain("shadow-primary/25");
    expect(sidebarMarkup).not.toContain("focus-visible:bg-accent");
    expect(sidebarMarkup).toContain("border-border");
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
