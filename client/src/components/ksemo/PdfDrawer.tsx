import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  isExcel,
  isPdf,
  isPowerPoint,
  isText,
  isWord,
  usePdfViewer,
} from "@/contexts/PdfViewerContext";
import { downloadFile } from "@/lib/downloadFile";
import { trpc } from "@/lib/trpc";
import { FileBrandMark, brandVariantForExt } from "./FileBrandIcons";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsDown,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUp,
  Download,
  Minus,
  Pencil,
  Plus,
  Presentation,
  Redo2,
  Save,
  Undo2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getDocumentProxy } from "unpdf";
import {
  CANONICAL_PART_NAME,
  SLIDE_WIDTH_IN,
  SLIDE_HEIGHT_IN,
  asCssColor,
  type PptElement,
  type PptPresentationSpec,
  type PptSlideSpec,
} from "@shared/presentation";

interface LinkAnnotation {
  url?: string;
  dest?: any;
  rect: { left: number; top: number; width: number; height: number };
}

interface TextItem {
  str: string;
  left: number;
  top: number;
  fontSize: number;
}

interface PdfPageItemProps {
  pdfDoc: any;
  pageNumber: number;
  scale: number;
  onNavigateDest?: (dest: any) => void;
  onPageVisible?: (pageNumber: number) => void;
}

const PdfPageItem = memo(function PdfPageItem({
  pdfDoc,
  pageNumber,
  scale,
  onNavigateDest,
  onPageVisible,
}: PdfPageItemProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [links, setLinks] = useState<LinkAnnotation[]>([]);
  const [textItems, setTextItems] = useState<TextItem[]>([]);
  const [dims, setDims] = useState<{ width: number; height: number }>({
    width: 600,
    height: 800,
  });

  // Track page visibility for the bottom-left page indicator
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !onPageVisible) return;

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            onPageVisible(pageNumber);
          }
        }
      },
      { threshold: 0.4 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [pageNumber, onPageVisible]);

  useEffect(() => {
    let isCancelled = false;

    async function renderPage() {
      try {
        if (!pdfDoc) return;
        setIsRendering(true);

        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // Task cancellation is normal when zooming rapidly
          }
        }

        const page = await pdfDoc.getPage(pageNumber);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale });
        const viewportWidth = Math.floor(viewport.width);
        const viewportHeight = Math.floor(viewport.height);
        setDims({ width: viewportWidth, height: viewportHeight });

        // 1. Render Canvas
        const canvas = canvasRef.current;
        if (canvas && !isCancelled) {
          const dpr =
            typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
          canvas.width = Math.floor(viewportWidth * dpr);
          canvas.height = Math.floor(viewportHeight * dpr);
          canvas.style.width = `${viewportWidth}px`;
          canvas.style.height = `${viewportHeight}px`;

          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.scale(dpr, dpr);
            const task = page.render({
              canvasContext: ctx,
              viewport,
            });
            renderTaskRef.current = task;
            await task.promise;
          }
        }

        if (isCancelled) return;

        // 2. Extract Interactive Links (e.g. Wikipedia links, web links, anchors)
        try {
          const annotations = await page.getAnnotations();
          const extractedLinks: LinkAnnotation[] = [];
          for (const ann of annotations) {
            if (ann.subtype === "Link" && (ann.url || ann.dest) && ann.rect) {
              const [x1, y1] = viewport.convertToViewportPoint(
                ann.rect[0],
                ann.rect[1]
              );
              const [x2, y2] = viewport.convertToViewportPoint(
                ann.rect[2],
                ann.rect[3]
              );
              const left = Math.min(x1, x2);
              const top = Math.min(y1, y2);
              const width = Math.abs(x2 - x1);
              const height = Math.abs(y2 - y1);

              extractedLinks.push({
                url: ann.url,
                dest: ann.dest,
                rect: { left, top, width, height },
              });
            }
          }
          if (!isCancelled) {
            setLinks(extractedLinks);
          }
        } catch {
          // Non-critical annotations error
        }

        // 3. Extract Text Content for Natural Text Selection
        try {
          const textContent = await page.getTextContent();
          const extractedText: TextItem[] = [];
          for (const item of textContent.items as any[]) {
            if (!item.str) continue;
            const [x, y] = viewport.convertToViewportPoint(
              item.transform[4],
              item.transform[5]
            );
            const fontSize = Math.hypot(item.transform[0], item.transform[1]);
            extractedText.push({
              str: item.str,
              left: x,
              top: y - fontSize,
              fontSize,
            });
          }
          if (!isCancelled) {
            setTextItems(extractedText);
          }
        } catch {
          // Non-critical text extraction error
        }

        if (!isCancelled) {
          setIsRendering(false);
        }
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException" && !isCancelled) {
          setIsRendering(false);
        }
      }
    }

    void renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Cleanup
        }
      }
    };
  }, [pdfDoc, pageNumber, scale]);

  return (
    <div
      ref={containerRef}
      data-testid={`pdf-page-${pageNumber}`}
      data-page={pageNumber}
      style={{
        width: `${dims.width}px`,
        height: `${dims.height}px`,
      }}
      className="relative mb-3 rounded-sm bg-white text-black shadow-xl border border-black/10 overflow-hidden mx-auto transition-transform"
    >
      {isRendering && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-xs"
          data-testid="pdf-page-loading"
        >
          <div className="loader text-muted-foreground" aria-hidden />
        </div>
      )}

      {/* Rendered Canvas Page */}
      <canvas ref={canvasRef} className="block pointer-events-none" />

      {/* Interactive Links Overlay (Wikipedia, external URLs, anchors) */}
      <div className="absolute inset-0 pointer-events-auto">
        {links.map((link, idx) => (
          <a
            key={idx}
            href={link.url || "#"}
            target={link.url ? "_blank" : undefined}
            rel={link.url ? "noopener noreferrer" : undefined}
            onClick={e => {
              if (link.dest && onNavigateDest) {
                e.preventDefault();
                onNavigateDest(link.dest);
              }
            }}
            style={{
              position: "absolute",
              left: `${link.rect.left}px`,
              top: `${link.rect.top}px`,
              width: `${link.rect.width}px`,
              height: `${link.rect.height}px`,
            }}
            title={link.url || "Go to link destination"}
            className="cursor-pointer hover:bg-blue-500/15 transition-colors rounded-xs z-10 block"
          />
        ))}
      </div>

      {/* Selectable Text Layer */}
      <div
        className="absolute inset-0 pointer-events-auto overflow-hidden opacity-0 select-text selection:bg-blue-500/30"
        aria-hidden="true"
      >
        {textItems.map((item, idx) => (
          <span
            key={idx}
            style={{
              position: "absolute",
              left: `${item.left}px`,
              top: `${item.top}px`,
              fontSize: `${item.fontSize}px`,
              fontFamily: "sans-serif",
              lineHeight: 1,
              whiteSpace: "pre",
            }}
          >
            {item.str}
          </span>
        ))}
      </div>
    </div>
  );
});

interface SlideData {
  slideNumber: number;
  title: string;
  items: { text: string; isTitle?: boolean; isBullet?: boolean }[];
}

export interface ExcelSheetData {
  name: string;
  data: any[][];
}

function getColumnLetter(colIndex: number): string {
  let letter = "";
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

function colIndexFromLetters(letters: string): number {
  let idx = 0;
  for (const ch of letters) {
    idx = idx * 26 + (ch.charCodeAt(0) - 64);
  }
  return idx - 1;
}

// Copy a formula to a new position: relative refs move with the delta,
// absolute refs ($A$1, $A1, A$1) stay anchored.
function adjustFormulaRefs(
  formula: string,
  dRow: number,
  dCol: number
): string {
  return formula.replace(
    /(\$?)([A-Z]+)(\$?)(\d+)/g,
    (m, dc: string, cols: string, dr: string, rn: string) => {
      const newCol =
        dc === "$" ? cols : getColumnLetter(colIndexFromLetters(cols) + dCol);
      const rowNum = parseInt(rn, 10);
      const newRow = dr === "$" ? rn : String(rowNum + dRow);
      return dc + newCol + dr + newRow;
    }
  );
}

// Copy plain text to the clipboard with a fallback for non-secure contexts
async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to the legacy execCommand approach below
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

async function parsePptxSlides(buffer: ArrayBuffer): Promise<SlideData[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const slideFileNames = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.replace(/\D+/g, ""), 10);
      const numB = parseInt(b.replace(/\D+/g, ""), 10);
      return numA - numB;
    });

  const slides: SlideData[] = [];

  for (let i = 0; i < slideFileNames.length; i++) {
    const name = slideFileNames[i];
    const xml = await zip.files[name].async("string");

    const pRegex = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g;
    const items: { text: string; isTitle?: boolean; isBullet?: boolean }[] = [];
    let slideTitle = "";
    let pMatch: RegExpExecArray | null;

    while ((pMatch = pRegex.exec(xml))) {
      const pContent = pMatch[1];
      const tRegex = /<(?:a:t|a:fld)[^>]*>([^<]*)<\/(?:a:t|a:fld)>/g;
      const textParts: string[] = [];
      let tMatch: RegExpExecArray | null;
      while ((tMatch = tRegex.exec(pContent))) {
        const val = tMatch[1].trim();
        if (val) textParts.push(val);
      }
      const fullText = textParts.join(" ").trim();
      if (fullText) {
        if (!slideTitle) {
          slideTitle = fullText;
          items.push({ text: fullText, isTitle: true });
        } else {
          items.push({ text: fullText, isBullet: true });
        }
      }
    }

    slides.push({
      slideNumber: i + 1,
      title: slideTitle || `Slide ${i + 1}`,
      items:
        items.length > 0 ? items : [{ text: `Slide ${i + 1}`, isTitle: true }],
    });
  }

  return slides;
}

// If the .pptx was produced by the KSEMO engine it embeds its canonical
// presentation spec at ppt/canonical.json. Prefer faithfully re-rendering that
// spec over text-only sniffing of the raw slides.
async function parseCanonicalSpec(buffer: ArrayBuffer): Promise<PptPresentationSpec | null> {
  try {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buffer);
    const file = zip.files[CANONICAL_PART_NAME];
    if (!file) return null;
    const raw = await file.async("string");
    const spec = JSON.parse(raw) as PptPresentationSpec;
    if (!spec || spec.version !== 1 || !Array.isArray(spec.slides)) return null;
    return spec;
  } catch {
    return null;
  }
}

export function isPageNumberOrFileFooter(
  text?: string,
  filename?: string
): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  // Match pure numbers, e.g. "1", "01"
  if (/^\d+$/.test(trimmed)) return true;
  // Match "1 of 5", "Slide 1 of 5", "Page 2 / 10", "1/5", etc.
  if (/^(slide|page)?\s*#?\d+(\s*(of|\/)\s*\d+)?\.?$/i.test(trimmed)) return true;
  if (/^\d+\s*[\/of]\s*\d+$/i.test(trimmed)) return true;
  if (/^(slide|page)\s*#?\d+$/i.test(trimmed)) return true;
  if (filename) {
    const fnLower = filename.toLowerCase();
    const baseFn = filename.replace(/\.[^.]+$/, "").toLowerCase();
    const tLower = trimmed.toLowerCase();
    if (tLower === fnLower || tLower === baseFn) return true;
    if (
      baseFn.length >= 3 &&
      (tLower.startsWith(baseFn) || tLower.endsWith(baseFn))
    ) {
      return true;
    }
  }
  return false;
}

export function isLightOrWhiteBorder(color?: string): boolean {
  if (!color) return true;
  const c = color.trim().toLowerCase().replace(/^#/, "");
  if (c === "white" || c === "fff" || c === "ffffff" || c === "transparent") return true;
  if (/^(e4e7ec|e2e5ea|d7e2ee|e2dcd1|e3daca|dcdfe8|e2dfd3|e1e7f0|cfe0f5|d6e2ee|e4dcc8|e0dfe6|d9e2dc|e6ddce)$/i.test(c)) {
    return true;
  }
  if (/^[0-9a-f]{6}$/i.test(c)) {
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    if (r > 210 && g > 210 && b > 210) return true;
  }
  return false;
}

export interface PresentationPreviewProps {
  spec: PptPresentationSpec;
  scale?: number;
  slideWidth?: number;
  slideHeight?: number;
  filename?: string;
  onPageVisible?: (slideNumber: number) => void;
}

function renderPptElement(
  el: PptElement,
  key: number
): React.ReactNode {
  const box = el.box;
  const style: React.CSSProperties = {
    position: "absolute",
    left: `${(box.x / SLIDE_WIDTH_IN) * 100}%`,
    top: `${(box.y / SLIDE_HEIGHT_IN) * 100}%`,
    width: `${(box.w / SLIDE_WIDTH_IN) * 100}%`,
    height: `${(box.h / SLIDE_HEIGHT_IN) * 100}%`,
  };
  // Design canvas is SLIDE_WIDTH_IN*96 ≈ 1280px wide. `--s` holds the rendered
  // slide width in px, so every metric must be scaled by s/1280 (unitless).
  const scl = (px: number) => (px / 1280).toFixed(6);
  const fontOf = (pt: number) => (pt / 960).toFixed(6);
  const fontPx = (pt: number) => `calc(var(--s) * ${fontOf(pt)})`;

  switch (el.kind) {
    case "text": {
      const verticalAlignMap: Record<string, string> = {
        top: "flex-start",
        middle: "center",
        bottom: "flex-end",
      };
      const textAlignMap: Record<string, string> = {
        center: "center",
        right: "right",
      };
      return (
        <div
          key={key}
          style={{
            ...style,
            display: "flex",
            alignItems: verticalAlignMap[el.valign ?? "top"] ?? "flex-start",
            justifyContent:
              el.align === "center"
                ? "center"
                : el.align === "right"
                  ? "flex-end"
                  : "flex-start",
            color: asCssColor(el.color),
            fontSize: fontPx(el.fontSize),
            fontWeight: el.bold ? "700" : "400",
            fontFamily: el.font,
            fontStyle: el.italic ? "italic" : "normal",
            lineHeight: `${el.lineSpacing ?? 1.15}`,
            letterSpacing: el.letterSpacing
              ? `calc(var(--s) * ${(el.letterSpacing / 960).toFixed(6)})`
              : undefined,
            opacity: (el.opacity ?? 100) / 100,
            whiteSpace: "pre-wrap",
            overflow: "hidden",
            padding: "0 0.05em",
          }}
        >
          <span>
            {el.bullet ? "• " : ""}
            {el.text}
          </span>
        </div>
      );
    }
    case "shape": {
      const fill = el.fill
        ? asCssColor(el.fill)
        : el.lineColor
          ? "transparent"
          : "#000";
      const hasWhiteOrLightBorder = isLightOrWhiteBorder(el.lineColor);
      const shouldDrawBorder = Boolean(
        el.lineColor &&
        !hasWhiteOrLightBorder &&
        (el.shape === "line" || !el.fill)
      );
      const base: React.CSSProperties = {
        ...style,
        background:
          el.shape === "line" ? undefined : fill,
        border: shouldDrawBorder
          ? `calc(var(--s) * ${scl(Math.max(el.lineWidth ?? 1, 1))}) solid ${asCssColor(el.lineColor)}`
          : undefined,
        // opacity is a 0-100 alpha; express the true alpha in CSS form.
        opacity: el.opacity !== undefined ? el.opacity / 100 : undefined,
        transform: el.flipV ? "scaleY(-1)" : undefined,
      };
      if (el.shape === "ellipse") {
        return <div key={key} style={{ ...base, borderRadius: "50%" }} />;
      }
      if (el.shape === "roundRect") {
        return (
          <div
            key={key}
            style={{
              ...base,
              borderRadius: `calc(var(--s) * ${scl(Math.max(el.radius ?? 0.1, 0) * 96)})`,
            }}
          />
        );
      }
      if (el.shape === "chevron") {
        return (
          <div
            key={key}
            style={{
              ...base,
              clipPath:
                "polygon(0 0, 62% 0, 100% 50%, 62% 100%, 0 100%, 38% 50%)",
            }}
          />
        );
      }
      return <div key={key} style={base} />;
    }
    case "image": {
      const isRenderable = /^(data:|https?:|blob:)/i.test(el.src ?? "");
      return (
        <div
          key={key}
          style={{
            ...style,
            overflow: "hidden",
            borderRadius: el.radius
              ? `calc(var(--s) * ${scl(el.radius * 96)})`
              : undefined,
            background:
              "repeating-linear-gradient(135deg, rgba(127,127,127,0.12) 0, rgba(127,127,127,0.12) 8px, transparent 8px, transparent 16px)",
          }}
        >
          {isRenderable ? (
            <img
              src={el.src}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: el.fit === "contain" ? "contain" : "cover",
              }}
            />
          ) : null}
        </div>
      );
    }
    case "table": {
      const fontSize = fontPx(Math.min(el.fontSize, 12));
      return (
        <div
          key={key}
          style={{
            ...style,
            overflow: "hidden",
            fontSize,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {el.headers.map((h, i) => (
                  <th
                    key={i}
                    style={{
                      background: asCssColor(el.headerFill),
                      color: asCssColor(el.headerColor),
                      textAlign: "left",
                      padding: `calc(var(--s) * ${scl(3)}) calc(var(--s) * ${scl(5)})`,
                      fontWeight: "700",
                      border: isLightOrWhiteBorder(el.borderColor)
                        ? undefined
                        : `1px solid ${asCssColor(el.borderColor)}`,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {el.rows.map((row, r) => (
                <tr key={r} style={{ background: r % 2 === 1 ? asCssColor(el.altRowFill) : asCssColor(el.rowFill) }}>
                  {row.map((cell, c) => (
                    <td
                      key={c}
                      style={{
                        color: asCssColor(el.textColor),
                        padding: `calc(var(--s) * ${scl(3)}) calc(var(--s) * ${scl(5)})`,
                        border: isLightOrWhiteBorder(el.borderColor)
                          ? undefined
                          : `1px solid ${asCssColor(el.borderColor)}`,
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "barChart": {
      const maxVal = Math.max(el.max, ...el.data.map(d => d.value), 1);
      return (
        <div
          key={key}
          style={{
            ...style,
            display: "flex",
            alignItems: "flex-end",
            gap: `calc(var(--s) * ${scl(6)})`,
            padding: `calc(var(--s) * ${scl(6)})`,
          }}
        >
          {el.data.map((d, i) => {
            const ratio = d.value / maxVal;
            const fill = i % 2 === 0 ? asCssColor(el.color) : asCssColor(el.secondaryColor);
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  textAlign: "center",
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    fontSize: `calc(var(--s) * ${scl(7)})`,
                    color: asCssColor(el.valueColor),
                    marginBottom: `calc(var(--s) * ${scl(2)})`,
                    lineHeight: 1.1,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    width: "100%",
                  }}
                >
                  {d.value}
                </div>
                <div
                  style={{
                    width: "100%",
                    height: `${ratio * 100}%`,
                    background: fill,
                    borderRadius: `calc(var(--s) * ${scl(2)}) calc(var(--s) * ${scl(2)}) 0 0`,
                  }}
                />
                <div
                  style={{
                    fontSize: `calc(var(--s) * ${scl(7)})`,
                    color: asCssColor(el.labelColor),
                    marginTop: `calc(var(--s) * ${scl(3)})`,
                    lineHeight: 1.1,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    width: "100%",
                  }}
                >
                  {d.label}
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    default:
      return null;
  }
}

export const ExcelViewer = memo(function ExcelViewer({
  sheets,
  scale,
  onSheetsChange,
}: {
  sheets: ExcelSheetData[];
  scale: number;
  onSheetsChange?: (sheets: ExcelSheetData[]) => void;
}) {
  const [localSheets, setLocalSheets] = useState<ExcelSheetData[]>(sheets);

  useEffect(() => {
    setLocalSheets(sheets);
  }, [sheets]);

  const [activeSheetIdx, setActiveSheetIdx] = useState<number>(0);
  const [selectedCell, setSelectedCell] = useState<{
    row: number;
    col: number;
    coord: string;
    value: any;
  } | null>(null);

  const [editingCell, setEditingCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [selectedCol, setSelectedCol] = useState<number | null>(null);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [selectAll, setSelectAll] = useState<boolean>(false);
  const [range, setRange] = useState<{
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  } | null>(null);
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startRow: number;
    startCol: number;
  }>({ active: false, moved: false, startRow: 0, startCol: 0 });

  // Internal clipboard for Ctrl+C / Ctrl+X / Ctrl+V
  const clipboardRef = useRef<{
    grid: any[][];
    rows: number;
    cols: number;
    topLeft: { row: number; col: number };
  } | null>(null);

  const cellInputRef = useRef<HTMLInputElement | null>(null);
  const [undoStack, setUndoStack] = useState<ExcelSheetData[][]>([]);
  const [redoStack, setRedoStack] = useState<ExcelSheetData[][]>([]);
  const [renamingSheetIdx, setRenamingSheetIdx] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");

  const currentSheet = localSheets[activeSheetIdx] || {
    name: "Sheet1",
    data: [],
  };
  const maxColsInSheet = currentSheet.data.reduce(
    (max, r) => Math.max(max, Array.isArray(r) ? r.length : 0),
    0
  );
  const numCols = Math.max(maxColsInSheet, 50);
  const numRows = Math.max(currentSheet.data.length, 50);
  const usedRowCount = Math.max(currentSheet.data.length, 1);

  const colHeaders = Array.from({ length: numCols }, (_, i) =>
    getColumnLetter(i)
  );
  const rowIndices = Array.from({ length: numRows }, (_, i) => i);

  // Bounding box of the current selection (cell / range / row / column / all)
  const activeSelBounds = useMemo(() => {
    if (selectAll) {
      return {
        has: true,
        loRow: 0,
        hiRow: numRows - 1,
        loCol: 0,
        hiCol: numCols - 1,
      };
    }
    if (selectedCol !== null) {
      return {
        has: true,
        loRow: 0,
        hiRow: usedRowCount - 1,
        loCol: selectedCol,
        hiCol: selectedCol,
      };
    }
    if (selectedRow !== null) {
      return {
        has: true,
        loRow: selectedRow,
        hiRow: selectedRow,
        loCol: 0,
        hiCol: numCols - 1,
      };
    }
    if (range) {
      return {
        has: true,
        loRow: Math.min(range.startRow, range.endRow),
        hiRow: Math.max(range.startRow, range.endRow),
        loCol: Math.min(range.startCol, range.endCol),
        hiCol: Math.max(range.startCol, range.endCol),
      };
    }
    if (selectedCell) {
      return {
        has: true,
        loRow: selectedCell.row,
        hiRow: selectedCell.row,
        loCol: selectedCell.col,
        hiCol: selectedCell.col,
      };
    }
    return { has: false, loRow: 0, hiRow: -1, loCol: 0, hiCol: -1 };
  }, [
    selectAll,
    selectedCol,
    selectedRow,
    range,
    selectedCell,
    numRows,
    numCols,
    usedRowCount,
  ]);

  // Commit a change with undo/redo history (auto-saves to the parent)
  const commitChange = useCallback(
    (next: ExcelSheetData[]) => {
      setUndoStack(prev => [...prev, localSheets].slice(-50));
      setRedoStack([]);
      setLocalSheets(next);
      onSheetsChange?.(next);
    },
    [localSheets, onSheetsChange]
  );

  // Undo / Redo
  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, localSheets]);
    setLocalSheets(previous);
    onSheetsChange?.(previous);
    setSelectedCell({ row: 0, col: 0, coord: "A1", value: "" });
    setEditingCell(null);
    setSelectedCol(null);
    setSelectedRow(null);
    setSelectAll(false);
    setRange(null);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, localSheets]);
    setLocalSheets(next);
    onSheetsChange?.(next);
    setSelectedCell({ row: 0, col: 0, coord: "A1", value: "" });
    setEditingCell(null);
    setSelectedCol(null);
    setSelectedRow(null);
    setSelectAll(false);
    setRange(null);
  };

  // Sheet tab rename
  const commitRename = (sIdx: number) => {
    const newName = renameValue.trim();
    setRenamingSheetIdx(null);
    if (!newName || newName === localSheets[sIdx]?.name) return;
    const next = localSheets.map((s, idx) =>
      idx === sIdx ? { ...s, name: newName } : s
    );
    commitChange(next);
  };

  // Update cell value helper
  const updateCellValue = useCallback(
    (sheetIdx: number, rIdx: number, cIdx: number, val: string) => {
      const next = localSheets.map((s, idx) => {
        if (idx !== sheetIdx) return s;
        const rows = s.data.map(r => (Array.isArray(r) ? [...r] : []));
        while (rows.length <= rIdx) {
          rows.push([]);
        }
        while (rows[rIdx].length <= cIdx) {
          rows[rIdx].push("");
        }
        rows[rIdx][cIdx] = val;
        return { ...s, data: rows };
      });
      commitChange(next);
    },
    [localSheets, commitChange]
  );

  const selectCell = useCallback(
    (rIdx: number, cIdx: number) => {
      const val = currentSheet.data[rIdx]?.[cIdx] ?? "";
      setSelectedCell({
        row: rIdx,
        col: cIdx,
        coord: `${getColumnLetter(cIdx)}${rIdx + 1}`,
        value: val,
      });
      setEditingCell(null);
      setSelectedCol(null);
      setSelectedRow(null);
      setSelectAll(false);
      setRange({ startRow: rIdx, startCol: cIdx, endRow: rIdx, endCol: cIdx });
    },
    [currentSheet]
  );

  // Start a selection drag (mouse pressed on a cell)
  const handleCellMouseDown = (rIdx: number, cIdx: number) => {
    setSelectedCol(null);
    setSelectedRow(null);
    setSelectAll(false);
    setSelectedCell({
      row: rIdx,
      col: cIdx,
      coord: `${getColumnLetter(cIdx)}${rIdx + 1}`,
      value: currentSheet.data[rIdx]?.[cIdx] ?? "",
    });
    setRange({ startRow: rIdx, startCol: cIdx, endRow: rIdx, endCol: cIdx });
    setEditingCell(null);
    dragRef.current = {
      active: true,
      moved: false,
      startRow: rIdx,
      startCol: cIdx,
    };
  };

  // Dragging across cells extends the selection rectangle (Excel-style)
  const handleCellMouseEnter = (rIdx: number, cIdx: number) => {
    if (!dragRef.current.active) return;
    if (
      rIdx !== dragRef.current.startRow ||
      cIdx !== dragRef.current.startCol
    ) {
      dragRef.current.moved = true;
    }
    setRange(prev =>
      prev
        ? { ...prev, endRow: rIdx, endCol: cIdx }
        : { startRow: rIdx, startCol: cIdx, endRow: rIdx, endCol: cIdx }
    );
    setEditingCell(null);
  };

  // Handle cell click (Excel-style: single click selects only)
  const handleCellClick = (rIdx: number, cIdx: number, currentVal: any) => {
    // A real drag already handled the selection; ignore the trailing click
    if (dragRef.current.moved) {
      dragRef.current.moved = false;
      return;
    }
    setSelectedCell({
      row: rIdx,
      col: cIdx,
      coord: `${getColumnLetter(cIdx)}${rIdx + 1}`,
      value: currentVal ?? "",
    });
    setSelectedCol(null);
    setSelectedRow(null);
    setSelectAll(false);
    setRange({ startRow: rIdx, startCol: cIdx, endRow: rIdx, endCol: cIdx });
    setEditingCell(null);
  };

  // Handle cell double click
  const handleCellDoubleClick = (
    rIdx: number,
    cIdx: number,
    currentVal: any
  ) => {
    setSelectedCell({
      row: rIdx,
      col: cIdx,
      coord: `${getColumnLetter(cIdx)}${rIdx + 1}`,
      value: currentVal ?? "",
    });
    setSelectedCol(null);
    setSelectedRow(null);
    setSelectAll(false);
    setRange({ startRow: rIdx, startCol: cIdx, endRow: rIdx, endCol: cIdx });
    setEditingCell({ row: rIdx, col: cIdx });
    setEditValue(String(currentVal ?? ""));
  };

  // Select an entire column (click a column letter header)
  const selectColumn = useCallback(
    (cIdx: number) => {
      setSelectAll(false);
      setSelectedCol(cIdx);
      setSelectedRow(null);
      setSelectedCell({
        row: 0,
        col: cIdx,
        coord: `${getColumnLetter(cIdx)}1`,
        value: currentSheet.data[0]?.[cIdx] ?? "",
      });
      setEditingCell(null);
      setRange(null);
    },
    [currentSheet]
  );

  // Select an entire row (click a row number header)
  const selectRow = useCallback(
    (rIdx: number) => {
      setSelectAll(false);
      setSelectedRow(rIdx);
      setSelectedCol(null);
      setSelectedCell({
        row: rIdx,
        col: 0,
        coord: `A${rIdx + 1}`,
        value: currentSheet.data[rIdx]?.[0] ?? "",
      });
      setEditingCell(null);
      setRange(null);
    },
    [currentSheet]
  );

  // Select the whole spreadsheet (click the empty top-left corner box)
  const handleSelectAll = useCallback(() => {
    setSelectAll(true);
    setSelectedCol(null);
    setSelectedRow(null);
    setSelectedCell({
      row: 0,
      col: 0,
      coord: "A1",
      value: currentSheet.data[0]?.[0] ?? "",
    });
    setEditingCell(null);
    setRange(null);
  }, [currentSheet]);

  // Stop dragging when the mouse is released anywhere
  useEffect(() => {
    const handleMouseUp = () => {
      dragRef.current.active = false;
    };
    const handlePointerUp = () => {
      dragRef.current.active = false;
    };
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  // Build the current selection as a 2D clipboard block + plain TSV text
  const buildCopyBlock = useCallback(() => {
    const joinRow = (values: any[]) =>
      values.map(v => String(v ?? "")).join("\t");

    let grid: any[][] | null = null;
    let topLeft = { row: 0, col: 0 };

    const padRows = (rows: any[][], cols: number) =>
      rows.map(r => {
        const row = Array.isArray(r) ? r : [];
        return Array.from({ length: cols }, (_, i) => row[i] ?? "");
      });

    if (selectAll) {
      const cols = currentSheet.data.reduce(
        (m, r) => Math.max(m, Array.isArray(r) ? r.length : 0),
        0
      );
      grid = padRows(currentSheet.data, cols);
    } else if (selectedCol !== null) {
      grid = currentSheet.data.map(r => [
        (Array.isArray(r) ? r[selectedCol] : undefined) ?? "",
      ]);
      topLeft = { row: 0, col: selectedCol };
    } else if (selectedRow !== null) {
      grid = [
        Array.isArray(currentSheet.data[selectedRow])
          ? currentSheet.data[selectedRow]
          : [],
      ];
      topLeft = { row: selectedRow, col: 0 };
    } else if (range) {
      const loR = Math.min(range.startRow, range.endRow);
      const hiR = Math.max(range.startRow, range.endRow);
      const loC = Math.min(range.startCol, range.endCol);
      const hiC = Math.max(range.startCol, range.endCol);
      topLeft = { row: loR, col: loC };
      grid = [];
      for (let r = loR; r <= hiR; r++) {
        const row = Array.isArray(currentSheet.data[r])
          ? currentSheet.data[r]
          : [];
        const cells: any[] = [];
        for (let c = loC; c <= hiC; c++) cells.push(row[c] ?? "");
        grid.push(cells);
      }
    } else if (selectedCell) {
      grid = [[selectedCell.value ?? ""]];
      topLeft = { row: selectedCell.row, col: selectedCell.col };
    }
    if (!grid || grid.length === 0) return null;

    return {
      grid,
      rows: grid.length,
      cols: grid[0]?.length ?? 0,
      topLeft,
      text: grid.map(joinRow).join("\n"),
    };
  }, [selectAll, selectedCol, selectedRow, range, selectedCell, currentSheet]);

  // Copy the current selection (cell / range / row / column / whole sheet) so
  // it can be pasted into Excel verbatim (rows -> "\n", cells within a row ->
  // "\t") and stored internally for Ctrl+V
  const handleCopy = useCallback(() => {
    const block = buildCopyBlock();
    if (!block) return;
    clipboardRef.current = {
      grid: block.grid,
      rows: block.rows,
      cols: block.cols,
      topLeft: block.topLeft,
    };
    void copyTextToClipboard(block.text);
  }, [buildCopyBlock]);

  // Clear a rectangle of cells on the active sheet as one undoable step
  const clearCellsInRegion = useCallback(
    (loRow: number, hiRow: number, loCol: number, hiCol: number) => {
      const next = localSheets.map((s, idx) => {
        if (idx !== activeSheetIdx) return s;
        const rows = s.data.map(r => (Array.isArray(r) ? [...r] : []));
        for (let r = loRow; r <= hiRow; r++) {
          while (rows.length <= r) rows.push([]);
          const row = rows[r];
          for (let c = loCol; c <= hiCol; c++) {
            while (row.length <= c) row.push("");
            row[c] = "";
          }
        }
        return { ...s, data: rows };
      });
      commitChange(next);
    },
    [localSheets, activeSheetIdx, commitChange]
  );

  // Delete / Backspace: clear the whole current selection
  const clearCurrentSelection = useCallback(() => {
    if (!activeSelBounds.has) return;
    clearCellsInRegion(
      activeSelBounds.loRow,
      activeSelBounds.hiRow,
      activeSelBounds.loCol,
      activeSelBounds.hiCol
    );
  }, [activeSelBounds, clearCellsInRegion]);

  // Cut: copy then clear the source cells
  const handleCut = useCallback(() => {
    const block = buildCopyBlock();
    if (!block) return;
    handleCopy();
    clearCellsInRegion(
      block.topLeft.row,
      block.topLeft.row + block.rows - 1,
      block.topLeft.col,
      block.topLeft.col + block.cols - 1
    );
  }, [buildCopyBlock, handleCopy, clearCellsInRegion]);

  // Paste: repeat the clipped pattern over the current selection (or anchor)
  const handlePaste = useCallback(() => {
    const clip = clipboardRef.current;
    if (!clip || !selectedCell || clip.rows === 0 || clip.cols === 0) return;
    const anchorRow = selectedCell.row;
    const anchorCol = selectedCell.col;
    const selIsSingle =
      activeSelBounds.has &&
      activeSelBounds.loRow === activeSelBounds.hiRow &&
      activeSelBounds.loCol === activeSelBounds.hiCol;
    const dest =
      !selIsSingle && clip.rows === 1 && clip.cols === 1
        ? {
            loRow: activeSelBounds.loRow,
            hiRow: activeSelBounds.hiRow,
            loCol: activeSelBounds.loCol,
            hiCol: activeSelBounds.hiCol,
          }
        : {
            loRow: anchorRow,
            hiRow: selIsSingle
              ? anchorRow + clip.rows - 1
              : activeSelBounds.loRow + clip.rows - 1,
            loCol: anchorCol,
            hiCol: selIsSingle
              ? anchorCol + clip.cols - 1
              : activeSelBounds.loCol + clip.cols - 1,
          };
    const next = localSheets.map((s, idx) => {
      if (idx !== activeSheetIdx) return s;
      const rows = s.data.map(r => (Array.isArray(r) ? [...r] : []));
      for (let r = dest.loRow; r <= dest.hiRow; r++) {
        while (rows.length <= r) rows.push([]);
        const row = rows[r];
        const relR = (((r - dest.loRow) % clip.rows) + clip.rows) % clip.rows;
        for (let c = dest.loCol; c <= dest.hiCol; c++) {
          while (row.length <= c) row.push("");
          const relC = (((c - dest.loCol) % clip.cols) + clip.cols) % clip.cols;
          let v = clip.grid[relR][relC];
          if (typeof v === "string" && v.startsWith("=")) {
            const fromR = clip.topLeft.row + relR;
            const fromC = clip.topLeft.col + relC;
            v = adjustFormulaRefs(v, r - fromR, c - fromC);
          }
          row[c] = v;
        }
      }
      return { ...s, data: rows };
    });
    const changed = next.some(
      (s, idx) => idx === activeSheetIdx && s !== localSheets[idx]
    );
    if (changed) commitChange(next);
  }, [
    selectedCell,
    activeSelBounds,
    localSheets,
    activeSheetIdx,
    commitChange,
  ]);

  // Add new row at bottom
  const handleAddRow = () => {
    const sheet = { ...localSheets[activeSheetIdx] };
    const data = sheet.data.map(r => (Array.isArray(r) ? [...r] : []));
    data.push(new Array(numCols).fill(""));
    sheet.data = data;
    const next = [...localSheets];
    next[activeSheetIdx] = sheet;
    commitChange(next);
  };

  // Add new column at right
  const handleAddCol = () => {
    const sheet = { ...localSheets[activeSheetIdx] };
    const data = sheet.data.map(r => (Array.isArray(r) ? [...r, ""] : [""]));
    sheet.data = data;
    const next = [...localSheets];
    next[activeSheetIdx] = sheet;
    commitChange(next);
  };

  // Keyboard navigation & direct typing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      // Undo / Redo shortcuts (work even while editing a cell)
      if (mod && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if (mod && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Never hijack keys while the user is typing in a text field
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) {
        return;
      }

      // Select everything with Ctrl/Cmd+A
      if (mod && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        handleSelectAll();
        return;
      }

      // Copy the current selection (cell / row / column / whole sheet)
      if (mod && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        handleCopy();
        return;
      }
      // Cut the current selection (copy + clear it in one undo step)
      if (mod && (e.key === "x" || e.key === "X")) {
        e.preventDefault();
        handleCut();
        return;
      }
      // Paste the last copied block starting at the active cell
      if (mod && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        handlePaste();
        return;
      }

      if (editingCell) return;

      const isNavigationKey = [
        "ArrowDown",
        "ArrowUp",
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End",
        "PageUp",
        "PageDown",
        "Tab",
        "Enter",
        "F2",
        "Delete",
        "Backspace",
      ].includes(e.key);

      if (!selectedCell) {
        if (isNavigationKey) {
          e.preventDefault();
          selectCell(0, 0);
        }
        return;
      }

      const { row, col } = selectedCell;
      const lastRow = numRows - 1;
      const lastCol = numCols - 1;

      // Shift + Arrow extends the selection from the active cell
      const arrowKey = e.key.startsWith("Arrow") ? e.key : null;
      if (arrowKey && e.shiftKey) {
        e.preventDefault();
        let endRow = row;
        let endCol = col;
        if (arrowKey === "ArrowDown") endRow = Math.min(row + 1, lastRow);
        else if (arrowKey === "ArrowUp") endRow = Math.max(row - 1, 0);
        else if (arrowKey === "ArrowRight") endCol = Math.min(col + 1, lastCol);
        else if (arrowKey === "ArrowLeft") endCol = Math.max(col - 1, 0);
        setRange({ startRow: row, startCol: col, endRow, endCol });
        return;
      }
      // Ctrl/Cmd + Arrow jumps through data regions
      if (arrowKey && mod) {
        e.preventDefault();
        const anyVal = (rr: number, cc: number) => {
          const v = currentSheet.data[rr]?.[cc];
          return v !== undefined && v !== null && String(v) !== "";
        };
        const findEdge = (
          r: number,
          c: number,
          dr: number,
          dc: number
        ): { r: number; c: number } => {
          let curR = r;
          let curC = c;
          if (dr !== 0) {
            while (
              curR + dr >= 0 &&
              curR + dr <= lastRow &&
              anyVal(curR + dr, c)
            ) {
              curR += dr;
            }
          } else {
            while (
              curC + dc >= 0 &&
              curC + dc <= lastCol &&
              anyVal(r, curC + dc)
            ) {
              curC += dc;
            }
          }
          return { r: curR, c: curC };
        };
        const dirMap: Record<string, [number, number]> = {
          ArrowDown: [1, 0],
          ArrowUp: [-1, 0],
          ArrowRight: [0, 1],
          ArrowLeft: [0, -1],
        };
        const [dr, dc] = dirMap[arrowKey];
        const edge = findEdge(row, col, dr, dc);
        selectCell(edge.r, edge.c);
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          if (col > 0) selectCell(row, col - 1);
          else selectCell(Math.max(row - 1, 0), lastCol);
        } else {
          if (col < lastCol) selectCell(row, col + 1);
          else selectCell(Math.min(row + 1, lastRow), 0);
        }
      } else if (e.key === "Home") {
        e.preventDefault();
        if (mod) selectCell(0, 0);
        else selectCell(row, 0);
      } else if (e.key === "End") {
        e.preventDefault();
        if (mod) selectCell(lastRow, lastCol);
        else selectCell(row, lastCol);
      } else if (e.key === "PageDown") {
        e.preventDefault();
        selectCell(Math.min(row + 10, lastRow), col);
      } else if (e.key === "PageUp") {
        e.preventDefault();
        selectCell(Math.max(row - 10, 0), col);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        selectCell(Math.min(row + 1, lastRow), col);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectCell(Math.max(row - 1, 0), col);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        selectCell(row, Math.min(col + 1, lastCol));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        selectCell(row, Math.max(col - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        selectCell(Math.min(row + 1, lastRow), col);
      } else if (e.key === "F2") {
        e.preventDefault();
        setEditingCell({ row, col });
        setEditValue(String(selectedCell.value ?? ""));
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        clearCurrentSelection();
        setSelectedCell(prev => (prev ? { ...prev, value: "" } : null));
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setEditingCell({ row, col });
        setEditValue(e.key);
        updateCellValue(activeSheetIdx, row, col, e.key);
        setSelectedCell(prev => (prev ? { ...prev, value: e.key } : null));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    selectedCell,
    editingCell,
    numRows,
    numCols,
    activeSheetIdx,
    currentSheet,
    selectCell,
    updateCellValue,
    handleUndo,
    handleRedo,
    handleSelectAll,
    handleCopy,
    handleCut,
    handlePaste,
    clearCurrentSelection,
  ]);

  return (
    <div
      data-testid="excel-document-viewer"
      className="flex flex-col h-full w-full bg-background overflow-hidden select-none"
    >
      {/* Excel Formula Bar */}
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3.5 py-2 text-sm text-muted-foreground font-mono select-none shrink-0">
        {/* Active Cell Coordinate */}
        <span className="w-16 shrink-0 font-bold text-foreground text-center bg-card py-1.5 rounded-lg border border-border shadow-2xs">
          {selectedCell ? selectedCell.coord : "A1"}
        </span>

        {/* Editable Formula Bar Input */}
        <input
          type="text"
          value={
            selectedCell
              ? editingCell
                ? editValue
                : String(selectedCell.value ?? "")
              : ""
          }
          onChange={e => {
            const val = e.target.value;
            if (selectedCell) {
              setEditValue(val);
              updateCellValue(
                activeSheetIdx,
                selectedCell.row,
                selectedCell.col,
                val
              );
              setSelectedCell(prev => (prev ? { ...prev, value: val } : null));
            }
          }}
          onFocus={() => {
            if (selectedCell && !editingCell) {
              setEditValue(String(selectedCell.value ?? ""));
            }
          }}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              setEditingCell(null);
              if (selectedCell) {
                selectCell(selectedCell.row + 1, selectedCell.col);
              }
            }
          }}
          placeholder={
            selectedCell
              ? "Enter text, numbers, or formula..."
              : "Click any cell to edit"
          }
          className="flex-1 px-3 py-1.5 bg-background rounded-lg border border-border text-foreground font-sans text-sm outline-hidden transition-all placeholder:text-muted-foreground/40"
        />

        {/* Quick Add Row & Column buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleAddRow}
                className="px-3 py-1.5 text-xs font-semibold font-sans text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg border border-border/80 transition-colors cursor-pointer"
              >
                + Row
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Add a row at the bottom
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleAddCol}
                className="px-3 py-1.5 text-xs font-semibold font-sans text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg border border-border/80 transition-colors cursor-pointer"
              >
                + Col
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Add a column at the right
            </TooltipContent>
          </Tooltip>

          <span className="mx-1 h-5 w-px bg-border/80" />

          {/* Undo / Redo buttons */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                aria-label="Undo"
                className="px-2 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg border border-border/80 transition-colors cursor-pointer [&_svg]:size-4 disabled:opacity-30 disabled:pointer-events-none"
              >
                <Undo2 />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                aria-label="Redo"
                className="px-2 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg border border-border/80 transition-colors cursor-pointer [&_svg]:size-4 disabled:opacity-30 disabled:pointer-events-none"
              >
                <Redo2 />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Redo (Ctrl+Y)</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Spreadsheet Grid Table */}
      <div className="flex-1 overflow-auto bg-background select-none">
        <div
          style={{ zoom: scale !== 1.0 ? scale : undefined, minWidth: "100%" }}
        >
          <table className="border-separate border-spacing-0 text-xs text-foreground min-w-full table-fixed">
            <thead>
              <tr className="sticky top-0 z-20 bg-muted/95 backdrop-blur-xs shadow-2xs">
                {/* Top-left blank cell (select all) */}
                <th
                  onClick={handleSelectAll}
                  title="Click to select the whole sheet"
                  className={cn(
                    "sticky left-0 z-30 w-10 min-w-[40px] bg-muted border-r border-b border-border text-center font-normal text-muted-foreground/40 py-1 cursor-pointer transition-colors",
                    selectAll && "bg-emerald-500/20"
                  )}
                />
                {colHeaders.map((col, idx) => {
                  const isColSelected = selectedCol === idx || selectAll;
                  return (
                    <th
                      key={idx}
                      onClick={() => selectColumn(idx)}
                      className={cn(
                        "relative w-[120px] min-w-[100px] border-r border-b border-border px-2 py-1 text-center text-xs font-semibold cursor-pointer transition-colors select-none",
                        isColSelected
                          ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold"
                          : "text-muted-foreground bg-muted/80 hover:bg-muted"
                      )}
                    >
                      {col}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rowIndices.map(rIdx => {
                const rowData = currentSheet.data[rIdx] || [];
                const isRowSelected = selectedRow === rIdx || selectAll;
                return (
                  <tr key={rIdx} className="hover:bg-muted/15">
                    {/* Sticky Row Number */}
                    <th
                      onClick={() => selectRow(rIdx)}
                      className={cn(
                        "relative sticky left-0 z-10 w-10 min-w-[40px] border-r border-b border-border px-2 py-1 text-right font-mono text-[11px] font-normal cursor-pointer select-none transition-colors",
                        isRowSelected
                          ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {rIdx + 1}
                    </th>
                    {colHeaders.map((_, cIdx) => {
                      const val =
                        rowData[cIdx] !== undefined ? rowData[cIdx] : "";
                      const isEditing =
                        editingCell?.row === rIdx && editingCell?.col === cIdx;

                      // Drag range rectangle membership (Excel-style)
                      const rangeLoRow = range
                        ? Math.min(range.startRow, range.endRow)
                        : -1;
                      const rangeHiRow = range
                        ? Math.max(range.startRow, range.endRow)
                        : -2;
                      const rangeLoCol = range
                        ? Math.min(range.startCol, range.endCol)
                        : -1;
                      const rangeHiCol = range
                        ? Math.max(range.startCol, range.endCol)
                        : -2;
                      const inRange =
                        range !== null &&
                        rIdx >= rangeLoRow &&
                        rIdx <= rangeHiRow &&
                        cIdx >= rangeLoCol &&
                        cIdx <= rangeHiCol;
                      const isMultiRange =
                        range !== null &&
                        (range.startRow !== range.endRow ||
                          range.startCol !== range.endCol);

                      // Whole column / row / sheet selections draw a thin
                      // green outline around the entire band (Excel-style)
                      const selLoRow =
                        selectedRow !== null
                          ? selectedRow
                          : selectedCol !== null || selectAll
                            ? 0
                            : -1;
                      const selHiRow =
                        selectedRow !== null
                          ? selectedRow
                          : selectedCol !== null
                            ? usedRowCount - 1
                            : selectAll
                              ? numRows - 1
                              : -2;
                      const selLoCol =
                        selectedCol !== null
                          ? selectedCol
                          : selectedRow !== null || selectAll
                            ? 0
                            : -1;
                      const selHiCol =
                        selectedCol !== null
                          ? selectedCol
                          : selectedRow !== null || selectAll
                            ? numCols - 1
                            : -2;
                      const inBand =
                        selectedCol !== null ||
                        selectedRow !== null ||
                        selectAll;
                      const inBandCell =
                        inBand &&
                        rIdx >= selLoRow &&
                        rIdx <= selHiRow &&
                        cIdx >= selLoCol &&
                        cIdx <= selHiCol;
                      const bandEdgeStyle: React.CSSProperties | undefined =
                        inBandCell
                          ? {
                              ...(rIdx === selLoRow
                                ? { borderTop: "2px solid #10b981" }
                                : {}),
                              ...(rIdx === selHiRow
                                ? { borderBottom: "2px solid #10b981" }
                                : {}),
                              ...(cIdx === selLoCol
                                ? { borderLeft: "2px solid #10b981" }
                                : {}),
                              ...(cIdx === selHiCol
                                ? { borderRight: "2px solid #10b981" }
                                : {}),
                            }
                          : undefined;

                      // Only the thin outer line of the dragged rectangle is drawn
                      const rangeEdgeStyle: React.CSSProperties | undefined =
                        inRange && isMultiRange
                          ? {
                              ...(rIdx === rangeLoRow
                                ? { borderTop: "2px solid #10b981" }
                                : {}),
                              ...(rIdx === rangeHiRow
                                ? { borderBottom: "2px solid #10b981" }
                                : {}),
                              ...(cIdx === rangeLoCol
                                ? { borderLeft: "2px solid #10b981" }
                                : {}),
                              ...(cIdx === rangeHiCol
                                ? { borderRight: "2px solid #10b981" }
                                : {}),
                            }
                          : undefined;

                      // Active-cell ring only for a single-cell selection and
                      // never when a whole column / row / sheet is selected
                      const isSingleRange =
                        range !== null &&
                        range.startRow === range.endRow &&
                        range.startCol === range.endCol;
                      const showActiveRing =
                        !selectAll &&
                        selectedCol === null &&
                        selectedRow === null &&
                        isSingleRange &&
                        selectedCell?.row === rIdx &&
                        selectedCell?.col === cIdx;

                      return (
                        <td
                          key={cIdx}
                          data-cell
                          data-row={rIdx}
                          data-col={cIdx}
                          onPointerDown={e => {
                            if (e.button !== 0) return;
                            handleCellMouseDown(rIdx, cIdx);
                          }}
                          onPointerEnter={() =>
                            handleCellMouseEnter(rIdx, cIdx)
                          }
                          onMouseEnter={() => handleCellMouseEnter(rIdx, cIdx)}
                          onClick={() => handleCellClick(rIdx, cIdx, val)}
                          onDoubleClick={() =>
                            handleCellDoubleClick(rIdx, cIdx, val)
                          }
                          style={{
                            ...(bandEdgeStyle || {}),
                            ...(rangeEdgeStyle || {}),
                          }}
                          className={cn(
                            "relative w-[120px] min-w-[100px] border-r border-b border-border/60 px-2 py-1 text-xs truncate cursor-cell transition-colors",
                            inBandCell
                              ? "bg-white/[0.06] dark:bg-white/[0.06]"
                              : "",
                            showActiveRing
                              ? "ring-2 ring-emerald-600 ring-inset bg-white/[0.06] dark:bg-white/[0.06] font-medium"
                              : inRange && isMultiRange
                                ? ""
                                : "hover:bg-muted/30"
                          )}
                        >
                          {isEditing ? (
                            <input
                              ref={cellInputRef}
                              autoFocus
                              type="text"
                              value={editValue}
                              onClick={e => e.stopPropagation()}
                              onMouseDown={e => e.stopPropagation()}
                              onChange={e => {
                                const newVal = e.target.value;
                                setEditValue(newVal);
                                updateCellValue(
                                  activeSheetIdx,
                                  rIdx,
                                  cIdx,
                                  newVal
                                );
                                setSelectedCell(prev =>
                                  prev ? { ...prev, value: newVal } : null
                                );
                              }}
                              onKeyDown={e => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  setEditingCell(null);
                                  selectCell(rIdx + 1, cIdx);
                                } else if (e.key === "Tab") {
                                  e.preventDefault();
                                  setEditingCell(null);
                                  selectCell(rIdx, cIdx + 1);
                                } else if (e.key === "Escape") {
                                  setEditingCell(null);
                                }
                              }}
                              onBlur={() => setEditingCell(null)}
                              className="w-full border-none bg-transparent text-foreground font-sans text-xs px-0 py-0 outline-hidden"
                            />
                          ) : (
                            <span className="select-text block truncate">
                              {String(val)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Excel Sheet Tabs Footer */}
      <div className="flex items-center border-t border-border bg-muted/40 px-4 py-2 text-sm shrink-0 select-none">
        {/* Sheet Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          {localSheets.map((sheet, sIdx) => {
            const isActive = sIdx === activeSheetIdx;
            const isRenamingThis = renamingSheetIdx === sIdx;
            return (
              <button
                key={sIdx}
                type="button"
                onClick={() => {
                  if (isRenamingThis) return;
                  setActiveSheetIdx(sIdx);
                  setSelectedCell({
                    row: 0,
                    col: 0,
                    coord: "A1",
                    value: localSheets[sIdx]?.data[0]?.[0] ?? "",
                  });
                  setEditingCell(null);
                  setSelectedCol(null);
                  setSelectedRow(null);
                  setSelectAll(false);
                  setRange(null);
                }}
                onDoubleClick={e => {
                  e.stopPropagation();
                  setRenamingSheetIdx(sIdx);
                  setRenameValue(sheet.name);
                }}
                className={cn(
                  "px-4 py-1.5 text-sm font-semibold rounded-t-md transition-all cursor-pointer whitespace-nowrap",
                  isActive
                    ? "bg-background text-emerald-600 dark:text-emerald-400 border-t-2 border-t-emerald-600 border-x border-border shadow-xs font-bold"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                )}
              >
                {isRenamingThis ? (
                  <input
                    type="text"
                    autoFocus
                    value={renameValue}
                    onClick={e => e.stopPropagation()}
                    onDoubleClick={e => e.stopPropagation()}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => {
                      e.stopPropagation();
                      if (e.key === "Enter") commitRename(sIdx);
                      else if (e.key === "Escape") setRenamingSheetIdx(null);
                    }}
                    onBlur={() => commitRename(sIdx)}
                    className="min-w-20 bg-transparent text-foreground text-sm font-semibold px-0 py-0 leading-none outline-hidden"
                  />
                ) : (
                  sheet.name
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});

// Faithful preview: re-renders the canonical presentation spec used by the
// server engine, so the in-app preview matches the downloaded .pptx exactly.
export const PresentationPreview = memo(
  function PresentationPreview({
    spec,
    scale = 1.0,
    slideWidth,
    slideHeight,
    filename,
    onPageVisible,
  }: PresentationPreviewProps) {
    const slideElsRef = useRef<Array<HTMLDivElement | null>>([]);

    useEffect(() => {
      const els = slideElsRef.current;
      if (els.length === 0 || !onPageVisible) return;
      let raf = 0;
      const findScrollParent = (el: HTMLDivElement | null): HTMLElement => {
        let node = el?.parentElement ?? null;
        while (node) {
          const style = getComputedStyle(node);
          if (
            style.overflowY === "auto" ||
            style.overflowY === "scroll" ||
            style.overflow === "auto" ||
            style.overflow === "scroll"
          )
            return node;
          node = node.parentElement;
        }
        return document.documentElement;
      };
      const scrollParent = findScrollParent(els[0]);
      let lastVisibleSlide = 0;
      const intersectionArea = (
        a: { top: number; bottom: number },
        b: { top: number; bottom: number }
      ) => Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      const updateCurrentSlide = () => {
        const viewport =
          scrollParent === document.documentElement
            ? { top: 0, bottom: window.innerHeight }
            : (() => {
                const r = scrollParent.getBoundingClientRect();
                return { top: r.top, bottom: r.bottom };
              })();
        let bestIdx = 0;
        let bestArea = -1;
        for (let i = 0; i < els.length; i++) {
          const el = els[i];
          if (!el) continue;
          const rc = el.getBoundingClientRect();
          const area = intersectionArea(
            { top: rc.top, bottom: rc.bottom },
            viewport
          );
          if (area > bestArea) {
            bestArea = area;
            bestIdx = i;
          }
        }
        const visibleSlide = bestIdx + 1;
        if (visibleSlide !== lastVisibleSlide) {
          lastVisibleSlide = visibleSlide;
          onPageVisible(visibleSlide);
        }
      };
      const onScrollTick = () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(updateCurrentSlide);
      };
      updateCurrentSlide();
      scrollParent.addEventListener("scroll", onScrollTick, { passive: true });
      window.addEventListener("resize", onScrollTick);
      return () => {
        cancelAnimationFrame(raf);
        scrollParent.removeEventListener("scroll", onScrollTick);
        window.removeEventListener("resize", onScrollTick);
      };
    }, [spec, onPageVisible]);

    return (
      <div
        data-testid="ksemo-presentation-viewer"
        className="mx-auto flex flex-col items-center gap-6 py-4 w-full"
      >
        {spec.slides.map((slide, idx) => {
          const slideNumber = idx + 1;
          return (
            <div
              key={slide.index ?? idx}
              ref={el => {
                slideElsRef.current[idx] = el;
              }}
              data-testid={`ksemo-ppt-slide-${slideNumber}`}
              data-slide={slideNumber}
            className={cn(
              "relative aspect-[16/9] shadow-2xl rounded-2xl border border-border overflow-hidden select-text transition-all duration-150 shrink-0",
              slideWidth ? "" : "w-full max-w-[850px] min-h-[460px]"
            )}
            style={{
              width: slideWidth ? `${slideWidth}px` : undefined,
              height: slideHeight ? `${slideHeight}px` : undefined,
              zoom: (!slideWidth && scale !== 1.0) ? scale : undefined,
              background: asCssColor(slide.background),
            }}
          >
            <div
              className="relative h-full w-full"
              style={{
                background: asCssColor(slide.background),
                "--s": slideWidth ? `${slideWidth}px` : undefined,
              } as React.CSSProperties}
            >
              <ScaleScaler />
              {slide.elements
                .filter(
                  el =>
                    !(
                      el.kind === "text" &&
                      isPageNumberOrFileFooter(el.text, filename)
                    )
                )
                .map((el, i) => renderPptElement(el, i))}
            </div>
          </div>
        );
      })}
      </div>
    );
  }
);

// Measures the slide box and sets the `--s` custom property so absolutely
// positioned elements can scale fonts/proportions with the rendered width.
function ScaleScaler() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0) {
          el.style.setProperty("--s", `${width}px`);
          if (el.parentElement) {
            el.parentElement.style.setProperty("--s", `${width}px`);
          }
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className="absolute inset-0" aria-hidden />;
}

const PowerPointViewer = memo(function PowerPointViewer({
  slides,
  scale = 1.0,
  slideWidth,
  slideHeight,
  filename,
  onPageVisible,
}: {
  slides: SlideData[];
  scale?: number;
  slideWidth?: number;
  slideHeight?: number;
  filename?: string;
  onPageVisible?: (slideNumber: number) => void;
}) {
  const slideElsRef = useRef<Array<HTMLDivElement | null>>([]);

  // Track the current slide from scroll position (robust with CSS zoom, which
  // interferes with IntersectionObserver geometry).
  useEffect(() => {
    const els = slideElsRef.current;
    if (els.length === 0 || !onPageVisible) return;
    let raf = 0;

    const findScrollParent = (el: HTMLDivElement | null): HTMLElement => {
      let node = el?.parentElement ?? null;
      while (node) {
        const style = getComputedStyle(node);
        if (
          style.overflowY === "auto" ||
          style.overflowY === "scroll" ||
          style.overflow === "auto" ||
          style.overflow === "scroll"
        )
          return node;
        node = node.parentElement;
      }
      return document.documentElement;
    };

    const scrollParent = findScrollParent(els[0]);
    let lastVisibleSlide = 0;

    const intersectionArea = (
      a: { top: number; bottom: number },
      b: { top: number; bottom: number }
    ) => Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

    const updateCurrentSlide = () => {
      const viewport =
        scrollParent === document.documentElement
          ? { top: 0, bottom: window.innerHeight }
          : (() => {
              const r = scrollParent.getBoundingClientRect();
              return { top: r.top, bottom: r.bottom };
            })();
      let bestIdx = 0;
      let bestArea = -1;
      for (let i = 0; i < els.length; i++) {
        const el = els[i];
        if (!el) continue;
        const rc = el.getBoundingClientRect();
        const area = intersectionArea(
          { top: rc.top, bottom: rc.bottom },
          viewport
        );
        if (area > bestArea) {
          bestArea = area;
          bestIdx = i;
        }
      }
      const visibleSlide = bestIdx + 1;
      if (visibleSlide !== lastVisibleSlide) {
        lastVisibleSlide = visibleSlide;
        onPageVisible(visibleSlide);
      }
    };

    const onScrollTick = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(updateCurrentSlide);
    };

    updateCurrentSlide();
    scrollParent.addEventListener("scroll", onScrollTick, { passive: true });
    window.addEventListener("resize", onScrollTick);
    return () => {
      cancelAnimationFrame(raf);
      scrollParent.removeEventListener("scroll", onScrollTick);
      window.removeEventListener("resize", onScrollTick);
    };
  }, [slides, onPageVisible]);

  return (
    <div
      data-testid="powerpoint-document-viewer"
      className="mx-auto flex flex-col items-center gap-6 py-4 w-full"
    >
      {slides.map((slide, idx) => {
        const slideNumber = idx + 1;
        return (
          <div
            key={slide.slideNumber ?? slideNumber}
            ref={el => {
              slideElsRef.current[idx] = el;
            }}
            data-testid={`pptx-slide-${slideNumber}`}
            data-slide={slideNumber}
            className={cn(
              "aspect-[16/9] bg-white text-neutral-900 shadow-2xl rounded-2xl border border-border p-8 sm:p-14 flex flex-col justify-between select-text transition-all relative overflow-hidden shrink-0",
              slideWidth ? "" : "w-full max-w-[850px] min-h-[460px]"
            )}
            style={{
              width: slideWidth ? `${slideWidth}px` : undefined,
              height: slideHeight ? `${slideHeight}px` : undefined,
              zoom: !slideWidth && scale !== 1.0 ? scale : undefined,
            }}
          >
            {/* Header */}
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 leading-snug">
                {slide.title}
              </h2>
            </div>

            {/* Body */}
            <div className="my-6 space-y-3.5 flex-1 flex flex-col justify-center">
              {slide.items
                .filter(
                  it =>
                    !it.isTitle &&
                    !isPageNumberOrFileFooter(it.text, filename)
                )
                .map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <span className="size-2 rounded-full bg-neutral-400 mt-2 shrink-0" />
                    <p className="text-sm sm:text-base text-neutral-700 leading-relaxed font-normal">
                      {item.text}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
});

// Miniature slide thumbnail using canonical spec rendering
const PptCanonicalThumbnail = memo(function PptCanonicalThumbnail({
  slideNumber,
  slide,
  isActive,
  filename,
  onClick,
}: {
  slideNumber: number;
  slide?: PptSlideSpec;
  isActive: boolean;
  filename?: string;
  onClick: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scaleRatio, setScaleRatio] = useState<number>(0.14);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScaleRatio(w / 1280);
    };
    update();
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setScaleRatio(w / 1280);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`pptx-sidebar-thumb-${slideNumber}`}
      aria-label={`Go to slide ${slideNumber}`}
      aria-current={isActive ? "true" : undefined}
      className="group flex flex-col md:flex-row items-center gap-1 md:gap-1.5 w-24 sm:w-28 md:w-full shrink-0 text-left p-0.5 rounded-lg transition-colors focus:outline-none cursor-pointer bg-transparent active:bg-transparent hover:bg-transparent select-none"
    >
      <span
        className={cn(
          "w-4 text-center text-xs tabular-nums font-semibold shrink-0 select-none transition-colors",
          isActive
            ? "text-primary font-bold"
            : "text-muted-foreground/70 group-hover:text-foreground"
        )}
      >
        {slideNumber}
      </span>
      <div
        ref={containerRef}
        className={cn(
          "relative aspect-[16/9] w-full flex-1 rounded-lg overflow-hidden border transition-colors duration-150 select-none pointer-events-none",
          isActive
            ? "border-border shadow-xs ring-2 ring-primary/40"
            : "border-border/70 group-hover:border-border"
        )}
        style={{
          background: slide ? asCssColor(slide.background) : "#ffffff",
        }}
      >
        {slide && (
          <div
            style={{
              width: 1280,
              height: 720,
              transform: `scale(${scaleRatio})`,
              transformOrigin: "top left",
              background: asCssColor(slide.background),
            }}
            className="relative h-[720px] w-[1280px]"
          >
            {slide.elements
              .filter(
                el =>
                  !(
                    el.kind === "text" &&
                    isPageNumberOrFileFooter(el.text, filename)
                  )
              )
              .map((el, i) => renderPptElement(el, i))}
          </div>
        )}
      </div>
    </button>
  );
});

// Miniature slide thumbnail for fallback parsed PPTX
const PptFallbackThumbnail = memo(function PptFallbackThumbnail({
  slideNumber,
  slide,
  isActive,
  filename,
  onClick,
}: {
  slideNumber: number;
  slide?: SlideData;
  isActive: boolean;
  filename?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`pptx-sidebar-thumb-${slideNumber}`}
      aria-label={`Go to slide ${slideNumber}`}
      aria-current={isActive ? "true" : undefined}
      className="group flex flex-col md:flex-row items-center gap-1 md:gap-1.5 w-24 sm:w-28 md:w-full shrink-0 text-left p-0.5 rounded-lg transition-colors focus:outline-none cursor-pointer bg-transparent active:bg-transparent hover:bg-transparent select-none"
    >
      <span
        className={cn(
          "w-4 text-center text-xs tabular-nums font-semibold shrink-0 select-none transition-colors",
          isActive
            ? "text-primary font-bold"
            : "text-muted-foreground/70 group-hover:text-foreground"
        )}
      >
        {slideNumber}
      </span>
      <div
        className={cn(
          "relative aspect-[16/9] w-full flex-1 rounded-lg overflow-hidden border p-1.5 md:p-2 flex flex-col justify-between transition-colors duration-150 bg-card text-card-foreground select-none pointer-events-none",
          isActive
            ? "border-border shadow-xs ring-2 ring-primary/40"
            : "border-border/70 group-hover:border-border"
        )}
      >
        <p className="text-[10px] font-bold truncate text-foreground leading-tight">
          {slide?.title || `Slide ${slideNumber}`}
        </p>
        <div className="space-y-1 flex-1 mt-1 overflow-hidden">
          {slide?.items
            ?.filter(
              it =>
                !it.isTitle &&
                !isPageNumberOrFileFooter(it.text, filename)
            )
            .slice(0, 3)
            .map((_, idx) => (
              <div key={idx} className="h-1 bg-muted rounded w-full" />
            ))}
        </div>
      </div>
    </button>
  );
});

export interface PptSlideSidebarProps {
  canonicalSpec?: PptPresentationSpec | null;
  slides?: SlideData[];
  currentSlide: number;
  filename?: string;
  onSelectSlide: (slideNumber: number) => void;
  isOpen: boolean;
  onClose?: () => void;
}

export const PptSlideSidebar = memo(function PptSlideSidebar({
  canonicalSpec,
  slides,
  currentSlide,
  filename,
  onSelectSlide,
  isOpen,
  onClose,
}: PptSlideSidebarProps) {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const count = canonicalSpec ? canonicalSpec.slides.length : (slides?.length ?? 0);

  // Auto-scroll the active thumbnail into view in the sidebar
  useEffect(() => {
    if (!sidebarRef.current) return;
    const activeEl = sidebarRef.current.querySelector(
      `[data-testid="pptx-sidebar-thumb-${currentSlide}"]`
    );
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [currentSlide]);

  if (!isOpen || count === 0) return null;

  return (
    <aside
      ref={sidebarRef}
      data-testid="pptx-sidebar"
      aria-label="Slide thumbnails"
      className="w-64 max-w-[80vw] md:w-52 shrink-0 h-full flex flex-col border-r border-border bg-card/95 dark:bg-card/90 backdrop-blur-md z-20 select-none transition-all"
    >
      {/* Sidebar Header */}
      <div className="flex h-11 items-center justify-between px-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Presentation className="size-4 text-foreground/80 shrink-0 stroke-[2]" />
          <span className="text-sm font-semibold tracking-tight text-foreground truncate">
            Slides
          </span>
          <span
            data-testid="pptx-sidebar-count-badge"
            className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground bg-muted/60 dark:bg-muted/40 rounded-full shrink-0"
          >
            {count}
          </span>
        </div>
        {onClose && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                data-testid="pptx-sidebar-collapse-btn"
                aria-label="Collapse sidebar"
                className="size-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground active:scale-95 transition-all"
              >
                <X className="size-4 md:hidden" />
                <ChevronsLeft className="size-4 hidden md:block" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Collapse sidebar</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Thumbnails Scroll List */}
      <div className="overflow-y-auto px-2 py-2 flex flex-col gap-2 flex-1 [scrollbar-width:thin]">
        {Array.from({ length: count }, (_, idx) => {
          const slideNumber = idx + 1;
          const isActive = currentSlide === slideNumber;

          if (canonicalSpec) {
            const slideSpec = canonicalSpec.slides[idx];
            return (
              <PptCanonicalThumbnail
                key={slideSpec?.index ?? idx}
                slideNumber={slideNumber}
                slide={slideSpec}
                isActive={isActive}
                filename={filename}
                onClick={() => onSelectSlide(slideNumber)}
              />
            );
          }

          const slideData = slides?.[idx];
          return (
            <PptFallbackThumbnail
              key={slideData?.slideNumber ?? idx}
              slideNumber={slideNumber}
              slide={slideData}
              isActive={isActive}
              filename={filename}
              onClick={() => onSelectSlide(slideNumber)}
            />
          );
        })}
      </div>
    </aside>
  );
});

interface EditablePageFieldProps {
  value: number;
  total: number;
  label: string;
  onNavigate: (n: number) => void;
}

// Editable page/slide number: shows a clean "1 / 11" button; click it to turn
// into the current page number input. Enter jumps, Esc cancels.
const EditablePageField = memo(function EditablePageField({
  value,
  total,
  label,
  onNavigate,
}: EditablePageFieldProps) {
  const [editing, setEditing] = useState<boolean>(false);
  const [draft, setDraft] = useState<string>(String(value));
  const inputRef = useRef<HTMLInputElement | null>(null);

  const startEditing = useCallback(() => {
    setDraft(String(value));
    setEditing(true);
  }, [value]);

  const commit = useCallback(() => {
    setEditing(false);
    const num = Number.parseInt(draft, 10);
    if (Number.isFinite(num) && num >= 1 && num <= total) {
      onNavigate(num);
    }
  }, [draft, total, onNavigate]);

  const cancel = useCallback(() => {
    setDraft(String(value));
    setEditing(false);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(
        inputRef.current.value.length,
        inputRef.current.value.length
      );
    }
  }, [editing]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEditing}
        aria-label={`${label} ${value} of ${total}`}
        className="flex h-9 min-w-[72px] cursor-pointer select-none items-center justify-center gap-1 rounded-lg px-2.5 text-sm font-bold tabular-nums text-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        {value}
        <span className="font-semibold text-muted-foreground">/</span>
        <span className="font-semibold text-muted-foreground">{total}</span>
      </button>
    );
  }

  return (
    <span className="flex select-none items-center gap-1 px-1 tabular-nums">
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={`${label} number`}
        value={draft}
        onChange={e => setDraft(e.target.value.replace(/[^\d]/g, ""))}
        onKeyDown={e => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            cancel();
          }
        }}
        onBlur={cancel}
        className="h-9 w-11 rounded-lg bg-accent text-center text-sm font-bold text-foreground outline-none"
      />
    </span>
  );
});

// A4 dimensions at 96 DPI
const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const A4_PADDING_X = 48;
const A4_PADDING_Y = 48;
const A4_CONTENT_HEIGHT = A4_HEIGHT - A4_PADDING_Y * 2;

/** Split mammoth-generated HTML into A4-sized page chunks. */
function splitWordHtmlIntoPages(html: string): string[] {
  if (!html.trim()) return [""];

  const container = document.createElement("div");
  container.style.cssText =
    "position:absolute;left:-9999px;top:0;width:" +
    (A4_WIDTH - A4_PADDING_X * 2) +
    "px;visibility:hidden;overflow:visible;";
  container.innerHTML = html;
  document.body.appendChild(container);

  const blocks = Array.from(container.children);
  if (blocks.length === 0) {
    document.body.removeChild(container);
    return [html];
  }

  const pages: string[][] = [[]];
  let currentHeight = 0;

  for (const block of blocks) {
    const blockHeight = (block as HTMLElement).getBoundingClientRect().height;

    if (
      currentHeight + blockHeight > A4_CONTENT_HEIGHT &&
      pages[pages.length - 1].length > 0
    ) {
      pages.push([]);
      currentHeight = 0;
    }

    pages[pages.length - 1].push(block.outerHTML);
    currentHeight += blockHeight;
  }

  document.body.removeChild(container);
  return pages.map(p => p.join(""));
}

interface WordPageItemProps {
  pageNumber: number;
  html: string;
  scale: number;
  rootRef?: (el: HTMLDivElement | null) => void;
}

const WordPageItem = memo(function WordPageItem({
  pageNumber,
  html,
  scale,
  rootRef,
}: WordPageItemProps) {
  return (
    <div
      ref={rootRef}
      data-page={pageNumber}
      className="relative mx-auto my-2 bg-white text-neutral-900 shadow-2xl rounded-xs border border-neutral-300/80 p-12 sm:p-16 select-text selection:bg-blue-500/30 transition-transform origin-top word-document-content font-sans"
      style={{
        width: `${A4_WIDTH}px`,
        maxWidth: "100%",
        minHeight: `${A4_HEIGHT}px`,
        zoom: scale !== 1.0 ? scale : undefined,
      }}
    >
      <div
        className="space-y-4 text-neutral-800 leading-relaxed [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-neutral-900 [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-neutral-900 [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-neutral-900 [&_h3]:mb-2 [&_p]:mb-3.5 [&_p]:text-[14.5px] [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-3.5 [&_li]:mb-1 [&_table]:w-full [&_table]:border-collapse [&_table]:border [&_table]:border-neutral-300 [&_table]:my-4 [&_th]:border [&_th]:border-neutral-300 [&_th]:bg-neutral-50 [&_th]:px-3.5 [&_th]:py-2 [&_th]:text-xs [&_th]:font-semibold [&_th]:text-left [&_td]:border [&_td]:border-neutral-300 [&_td]:px-3.5 [&_td]:py-2 [&_td]:text-xs [&_blockquote]:border-l-4 [&_blockquote]:border-blue-500 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-3.5 [&_blockquote]:text-neutral-600 [&_a]:text-blue-600 [&_a]:underline [&_a]:underline-offset-2 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_img]:my-3"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {/* Page number, bottom-right corner only */}
      <span className="absolute bottom-3 right-6 select-none text-[11px] font-medium tabular-nums text-neutral-400">
        {pageNumber}
      </span>
    </div>
  );
});

interface WordPageViewerProps {
  html: string;
  scale: number;
  onPageVisible?: (pageNumber: number) => void;
  onPageCount?: (count: number) => void;
}

const WordPageViewer = memo(function WordPageViewer({
  html,
  scale,
  onPageVisible,
  onPageCount,
}: WordPageViewerProps) {
  const pages = useMemo(() => splitWordHtmlIntoPages(html), [html]);
  const pageElsRef = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    onPageCount?.(pages.length);
  }, [pages.length, onPageCount]);

  // Track the current page from scroll position (robust with CSS zoom, which
  // interferes with IntersectionObserver geometry).
  useEffect(() => {
    const els = pageElsRef.current;
    if (els.length === 0 || !onPageVisible) return;
    let raf = 0;

    const findScrollParent = (el: HTMLDivElement | null): HTMLElement => {
      let node = el?.parentElement ?? null;
      while (node) {
        const style = getComputedStyle(node);
        if (
          style.overflowY === "auto" ||
          style.overflowY === "scroll" ||
          style.overflow === "auto" ||
          style.overflow === "scroll"
        )
          return node;
        node = node.parentElement;
      }
      return document.documentElement;
    };

    const scrollParent = findScrollParent(els[0]);
    let lastVisiblePage = 0;

    const intersectionArea = (
      a: { top: number; bottom: number },
      b: { top: number; bottom: number }
    ) => Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

    const updateCurrentPage = () => {
      const viewport =
        scrollParent === document.documentElement
          ? { top: 0, bottom: window.innerHeight }
          : (() => {
              const r = scrollParent.getBoundingClientRect();
              return { top: r.top, bottom: r.bottom };
            })();
      let bestPage = 1;
      let bestArea = -1;
      for (let i = 0; i < els.length; i++) {
        const el = els[i];
        if (!el) continue;
        const rc = el.getBoundingClientRect();
        const area = intersectionArea(
          { top: rc.top, bottom: rc.bottom },
          viewport
        );
        if (area > bestArea) {
          bestArea = area;
          bestPage = i + 1;
        }
      }
      if (bestPage !== lastVisiblePage) {
        lastVisiblePage = bestPage;
        onPageVisible(bestPage);
      }
    };

    const onScrollTick = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(updateCurrentPage);
    };

    updateCurrentPage();
    scrollParent.addEventListener("scroll", onScrollTick, { passive: true });
    window.addEventListener("resize", onScrollTick);
    return () => {
      cancelAnimationFrame(raf);
      scrollParent.removeEventListener("scroll", onScrollTick);
      window.removeEventListener("resize", onScrollTick);
    };
  }, [pages.length, onPageVisible]);

  return (
    <div
      className="mx-auto flex flex-col items-center"
      data-testid="word-document-viewer"
    >
      {pages.map((pageHtml, idx) => (
        <WordPageItem
          key={idx}
          pageNumber={idx + 1}
          html={pageHtml}
          scale={scale}
          rootRef={el => {
            pageElsRef.current[idx] = el;
          }}
        />
      ))}
    </div>
  );
});

export const PdfDrawer = memo(function PdfDrawer() {
  const { currentPdf, isOpen, closePdf } = usePdfViewer();
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [wordHtml, setWordHtml] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [excelSheets, setExcelSheets] = useState<ExcelSheetData[]>([]);
  const [pptxSlides, setPptxSlides] = useState<SlideData[]>([]);
  const [canonicalSpec, setCanonicalSpec] = useState<PptPresentationSpec | null>(
    null
  );
  const [currentSlide, setCurrentSlide] = useState<number>(1);
  const [isPptSidebarOpen, setIsPptSidebarOpen] = useState<boolean>(true);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Text document inline editing + auto-save
  const [isEditingText, setIsEditingText] = useState<boolean>(false);
  const [draftText, setDraftText] = useState<string>("");
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const draftRef = useRef<string>("");
  const lastSavedRef = useRef<string | null>(null);
  const draftFileIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTextMutation = trpc.workspace.files.saveContent.useMutation();

  // Zoom management
  const [scale, setScale] = useState<number>(1.0);
  const [isFit, setIsFit] = useState<boolean>(true);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const basePageWidthRef = useRef<number>(600);

  const isPdfDoc = currentPdf
    ? isPdf(currentPdf.filename, currentPdf.mimeType)
    : false;
  const isWordDoc = currentPdf
    ? isWord(currentPdf.filename, currentPdf.mimeType)
    : false;
  const isExcelDoc = currentPdf
    ? isExcel(currentPdf.filename, currentPdf.mimeType)
    : false;
  const isPowerPointDoc = currentPdf
    ? isPowerPoint(currentPdf.filename, currentPdf.mimeType)
    : false;
  const isTextDoc = currentPdf
    ? isText(currentPdf.filename, currentPdf.mimeType)
    : false;
  const ext = currentPdf?.filename.split(".").pop() || "";
  const brandVariant = brandVariantForExt(ext);
  const pptxCount = canonicalSpec
    ? canonicalSpec.slides.length
    : pptxSlides.length;

  // Measure container width to dynamically calculate "Fit" scale
  const updateWidth = useCallback(() => {
    if (scrollContainerRef.current) {
      const width = scrollContainerRef.current.clientWidth;
      setContainerWidth(width);
      if (isFit && basePageWidthRef.current > 0) {
        const available = Math.max(width - 64, 280);
        setScale(Math.min(available / basePageWidthRef.current, 2.5));
      }
    }
  }, [isFit]);

  useEffect(() => {
    if (!isOpen) return;
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, [isOpen, updateWidth]);

  // PowerPoint 16:9 Canvas & Zoom Management (authentic PPT presentation scaling)
  const PPT_DESIGN_W = 1280;
  const PPT_DESIGN_H = 720;
  const PPT_ZOOM_STEPS = [0.4, 0.5, 0.67, 0.8, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5];
  const [pptZoomMultiplier, setPptZoomMultiplier] = useState<number>(1.0);
  const [isPptFit, setIsPptFit] = useState<boolean>(true);
  const [stageDimensions, setStageDimensions] = useState<{
    width: number;
    height: number;
  }>({
    width: 900,
    height: 600,
  });

  // Track stage container size for true PowerPoint 16:9 Fit
  useEffect(() => {
    if (!isOpen || !isPowerPointDoc || !scrollContainerRef.current) return;
    const el = scrollContainerRef.current;
    const update = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        setStageDimensions({ width: el.clientWidth, height: el.clientHeight });
      }
    };
    update();
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setStageDimensions({ width, height });
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isOpen, isPowerPointDoc, isPptSidebarOpen]);

  // In PowerPoint, "Fit" calculates the scale so the 16:9 slide fits both
  // horizontally and vertically inside the stage with comfortable margins.
  const pptFitScale = useMemo(() => {
    const isMobile = stageDimensions.width < 768;
    const availW = Math.max(stageDimensions.width - (isMobile ? 16 : 56), 240);
    const availH = Math.max(stageDimensions.height - (isMobile ? 16 : 56), 180);
    return Math.min(availW / PPT_DESIGN_W, availH / PPT_DESIGN_H);
  }, [stageDimensions.width, stageDimensions.height]);

  const effectivePptScale = isPptFit ? pptFitScale : pptZoomMultiplier;
  const pptSlideWidth = Math.round(PPT_DESIGN_W * effectivePptScale);
  const pptSlideHeight = Math.round(PPT_DESIGN_H * effectivePptScale);

  const handlePptZoomIn = useCallback(() => {
    setIsPptFit(false);
    setPptZoomMultiplier(curr => {
      const base = isPptFit ? pptFitScale : curr;
      const next = PPT_ZOOM_STEPS.find(s => s > base + 0.05);
      return next ?? PPT_ZOOM_STEPS[PPT_ZOOM_STEPS.length - 1];
    });
  }, [isPptFit, pptFitScale]);

  const handlePptZoomOut = useCallback(() => {
    setIsPptFit(false);
    setPptZoomMultiplier(curr => {
      const base = isPptFit ? pptFitScale : curr;
      const prev = [...PPT_ZOOM_STEPS].reverse().find(s => s < base - 0.05);
      return prev ?? PPT_ZOOM_STEPS[0];
    });
  }, [isPptFit, pptFitScale]);

  const handlePptToggleFit = useCallback(() => {
    if (isPptFit) {
      setIsPptFit(false);
      setPptZoomMultiplier(1.0);
    } else {
      setIsPptFit(true);
    }
  }, [isPptFit]);

  // Load Document (PDF, Word, Excel, PowerPoint, or Text) in-project
  useEffect(() => {
    if (!isOpen || !currentPdf?.url) {
      setPdfDoc(null);
      setWordHtml(null);
      setTextContent(null);
      setExcelSheets([]);
      setPptxSlides([]);
      setCanonicalSpec(null);
      setNumPages(0);
      setCurrentPage(1);
      setCurrentSlide(1);
      setLoadError(null);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setCurrentPage(1);
    setCurrentSlide(1);
    setNumPages(0);
    setPdfDoc(null);
    setWordHtml(null);
    setTextContent(null);
    setExcelSheets([]);
    setPptxSlides([]);
    setCanonicalSpec(null);

    async function loadDocument() {
      try {
        const response = await fetch(currentPdf!.url);
        if (!response.ok) {
          throw new Error(`Failed to load document (${response.status})`);
        }

        if (isPdfDoc) {
          const buffer = await response.arrayBuffer();
          if (isCancelled) return;

          const doc = await getDocumentProxy(new Uint8Array(buffer));
          if (isCancelled) return;

          setPdfDoc(doc);
          setNumPages(doc.numPages);

          const p1 = await doc.getPage(1);
          const vp = p1.getViewport({ scale: 1.0 });
          basePageWidthRef.current = vp.width;

          const available = Math.max(containerWidth - 64, 280);
          setScale(Math.min(available / vp.width, 2.5));
          setIsFit(true);
          setIsLoading(false);
        } else if (isWordDoc) {
          const buffer = await response.arrayBuffer();
          if (isCancelled) return;

          // @ts-expect-error - mammoth.browser.js is a UMD bundle without dedicated subpath typings
          const mammothModule = await import("mammoth/mammoth.browser.js");
          const mammoth = (mammothModule as any).default || mammothModule;
          const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
          if (isCancelled) return;

          setWordHtml(result.value);
          basePageWidthRef.current = 794; // Standard A4 width at 96 DPI
          const available = Math.max(containerWidth - 64, 280);
          setScale(Math.min(available / 794, 1.25));
          setIsFit(true);
          setIsLoading(false);
        } else if (isExcelDoc) {
          const buffer = await response.arrayBuffer();
          if (isCancelled) return;

          const XLSX = await import("xlsx");
          const workbook = XLSX.read(buffer, { type: "array" });
          const parsedSheets: ExcelSheetData[] = [];

          for (const name of workbook.SheetNames) {
            const worksheet = workbook.Sheets[name];
            const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, {
              header: 1,
              defval: "",
              blankrows: false,
            });
            parsedSheets.push({ name, data: rows });
          }

          if (isCancelled) return;
          setExcelSheets(parsedSheets);
          basePageWidthRef.current = 800;
          setScale(1.0);
          setIsFit(true);
          setIsLoading(false);
        } else if (isPowerPointDoc) {
          const buffer = await response.arrayBuffer();
          if (isCancelled) return;

          const canonical = await parseCanonicalSpec(buffer);
          if (isCancelled) return;

          setCanonicalSpec(canonical);
          if (canonical) {
            setPptxSlides([]);
            setCurrentSlide(1);
            basePageWidthRef.current = 850;
            const available = Math.max(containerWidth - 64, 280);
            setScale(Math.min(available / 850, 1.25));
            setIsFit(true);
            setIsLoading(false);
            return;
          }

          const slides = await parsePptxSlides(buffer);
          if (isCancelled) return;

          setPptxSlides(slides);
          setCurrentSlide(1);
          basePageWidthRef.current = 850;
          const available = Math.max(containerWidth - 64, 280);
          setScale(Math.min(available / 850, 1.25));
          setIsFit(true);
          setIsLoading(false);
        } else if (isTextDoc) {
          const text = await response.text();
          if (isCancelled) return;

          let formattedText = text;
          if (ext.toLowerCase() === "json") {
            try {
              formattedText = JSON.stringify(JSON.parse(text), null, 2);
            } catch {
              // fallback to raw text
            }
          }

          setTextContent(formattedText);
          basePageWidthRef.current = 800;
          const available = Math.max(containerWidth - 64, 280);
          setScale(Math.min(available / 800, 1.25));
          setIsFit(true);
          setIsLoading(false);
        } else {
          // Unsupported direct preview
          setIsLoading(false);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setLoadError(err?.message || "Could not load document in-project.");
          setIsLoading(false);
        }
      }
    }

    void loadDocument();

    return () => {
      isCancelled = true;
    };
  }, [
    isOpen,
    currentPdf?.url,
    currentPdf?.filename,
    isPdfDoc,
    isWordDoc,
    isExcelDoc,
    isPowerPointDoc,
    isTextDoc,
    ext,
    containerWidth,
  ]);

  // Persist edited text to the server (used by auto-save and on exit)
  const persistText = useCallback(
    async (
      content: string,
      fileId = draftFileIdRef.current ?? currentPdf?.id
    ) => {
      if (!fileId) {
        setSaveState("idle");
        return;
      }
      setSaveState("saving");
      try {
        await saveTextMutation.mutateAsync({ id: fileId, content });
        lastSavedRef.current = content;
        setTextContent(content);
        setSaveState("saved");
        if (saveResetTimerRef.current) {
          clearTimeout(saveResetTimerRef.current);
        }
        saveResetTimerRef.current = setTimeout(() => {
          if (draftRef.current === lastSavedRef.current) {
            setSaveState("idle");
          }
        }, 1500);
      } catch {
        setSaveState("error");
      }
    },
    [currentPdf?.id, saveTextMutation]
  );

  // Exit edit mode whenever the drawer closes or the file changes
  useEffect(() => {
    if (!isOpen || !currentPdf?.url) {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (draftRef.current && draftRef.current !== lastSavedRef.current) {
        void persistText(draftRef.current);
      }
      setIsEditingText(false);
      draftRef.current = "";
      lastSavedRef.current = null;
      draftFileIdRef.current = null;
    }
  }, [isOpen, currentPdf?.url, persistText]);

  // Debounced auto-save as the user types
  const handleTextChange = useCallback(
    (value: string) => {
      setDraftText(value);
      draftRef.current = value;
      if (value === lastSavedRef.current) {
        setSaveState("idle");
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        return;
      }
      setSaveState("saving");
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        void persistText(draftRef.current);
      }, 800);
    },
    [persistText]
  );

  // Toggle between view and edit for text documents
  const handleEditToggle = useCallback(() => {
    if (isEditingText) {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (draftRef.current !== lastSavedRef.current) {
        void persistText(draftRef.current);
      }
      setIsEditingText(false);
    } else {
      setDraftText(textContent ?? "");
      draftRef.current = textContent ?? "";
      lastSavedRef.current = textContent ?? null;
      draftFileIdRef.current = currentPdf?.id ?? null;
      setSaveState("idle");
      setIsEditingText(true);
    }
  }, [isEditingText, textContent, currentPdf?.id, persistText]);

  // Ctrl/Cmd+S inside the editor flushes the pending auto-save immediately
  useEffect(() => {
    if (!isEditingText) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        void persistText(draftRef.current);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditingText, persistText]);

  // Handle Zoom In
  const handleZoomIn = useCallback(() => {
    setIsFit(false);
    setScale(prev => Math.min(Number((prev + 0.15).toFixed(2)), 3.0));
  }, []);

  // Handle Zoom Out
  const handleZoomOut = useCallback(() => {
    setIsFit(false);
    setScale(prev => Math.max(Number((prev - 0.15).toFixed(2)), 0.25));
  }, []);

  // Toggle Fit / Reset
  const handleToggleFit = useCallback(() => {
    if (isFit) {
      setIsFit(false);
      setScale(1.0);
    } else {
      setIsFit(true);
      const available = Math.max(containerWidth - 64, 280);
      const base =
        basePageWidthRef.current > 0 ? basePageWidthRef.current : 800;
      setScale(Math.min(available / base, 2.5));
    }
  }, [isFit, containerWidth]);

  // Touchpad pinch-to-zoom / Ctrl+Wheel zoom handler
  useEffect(() => {
    if (!isOpen) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (isPowerPointDoc) {
          if (e.deltaY < 0) {
            handlePptZoomIn();
          } else {
            handlePptZoomOut();
          }
        } else {
          setIsFit(false);
          const zoomDelta = e.deltaY < 0 ? 0.08 : -0.08;
          setScale(prev =>
            Math.min(Math.max(Number((prev + zoomDelta).toFixed(2)), 0.25), 3.0)
          );
        }
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [isOpen, isPowerPointDoc, handlePptZoomIn, handlePptZoomOut]);

  // Scroll to a specific PowerPoint slide
  const scrollToSlide = useCallback((slideNum: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const target =
      container.querySelector<HTMLElement>(`[data-slide="${slideNum}"]`) ||
      container.querySelectorAll<HTMLElement>("[data-slide]")[slideNum - 1];
    if (target) {
      if (typeof container.scrollTo === "function") {
        const containerRect = container.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const targetTop =
          targetRect.top - containerRect.top + container.scrollTop;
        const offsetTop = Math.max(0, targetTop - 24);
        container.scrollTo({ top: offsetTop, behavior: "smooth" });
      } else {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setCurrentSlide(slideNum);
    }
  }, []);

  // Scroll to a specific page
  const scrollToPage = useCallback((pageNum: number) => {
    if (!scrollContainerRef.current) return;
    const target = scrollContainerRef.current.querySelector(
      `[data-page="${pageNum}"]`
    );
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setCurrentPage(pageNum);
    }
  }, []);

  // Keyboard shortcut handler for Escape, Zoom (+/-/0), and slide navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePdf();
        return;
      }

      const target = event.target as HTMLElement | null;
      const activeTag = target?.tagName?.toLowerCase();
      if (
        activeTag === "input" ||
        activeTag === "textarea" ||
        target?.isContentEditable
      )
        return;

      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      if (
        (isCtrlOrCmd && (event.key === "=" || event.key === "+")) ||
        (!isCtrlOrCmd && (event.key === "+" || event.key === "="))
      ) {
        event.preventDefault();
        if (isPowerPointDoc) {
          handlePptZoomIn();
        } else {
          handleZoomIn();
        }
      } else if (
        (isCtrlOrCmd && (event.key === "-" || event.key === "_")) ||
        (!isCtrlOrCmd && (event.key === "-" || event.key === "_"))
      ) {
        event.preventDefault();
        if (isPowerPointDoc) {
          handlePptZoomOut();
        } else {
          handleZoomOut();
        }
      } else if (isCtrlOrCmd && (event.key === "0" || event.key === "Digit0")) {
        event.preventDefault();
        if (isPowerPointDoc) {
          handlePptToggleFit();
        } else {
          handleToggleFit();
        }
      }

      // Word document arrow key page navigation
      if (isWordDoc && numPages > 0) {
        if (
          event.key === "ArrowRight" ||
          event.key === "ArrowDown" ||
          event.key === "PageDown"
        ) {
          event.preventDefault();
          if (currentPage < numPages) {
            scrollToPage(currentPage + 1);
          }
        } else if (
          event.key === "ArrowLeft" ||
          event.key === "ArrowUp" ||
          event.key === "PageUp"
        ) {
          event.preventDefault();
          if (currentPage > 1) {
            scrollToPage(currentPage - 1);
          }
        }
      }

      // PowerPoint slide arrow key navigation
      if (isPowerPointDoc && pptxCount > 0) {
        if (
          event.key === "ArrowRight" ||
          event.key === "ArrowDown" ||
          event.key === "PageDown"
        ) {
          event.preventDefault();
          if (currentSlide < pptxCount) {
            scrollToSlide(currentSlide + 1);
          }
        } else if (
          event.key === "ArrowLeft" ||
          event.key === "ArrowUp" ||
          event.key === "PageUp"
        ) {
          event.preventDefault();
          if (currentSlide > 1) {
            scrollToSlide(currentSlide - 1);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    closePdf,
    handleZoomIn,
    handleZoomOut,
    handleToggleFit,
    handlePptZoomIn,
    handlePptZoomOut,
    handlePptToggleFit,
    isWordDoc,
    numPages,
    currentPage,
    scrollToPage,
    isPowerPointDoc,
    pptxCount,
    currentSlide,
    scrollToSlide,
  ]);

  // Navigate destination internal anchor
  const handleNavigateDest = async (dest: any) => {
    if (!pdfDoc) return;
    try {
      let destArray = dest;
      if (typeof dest === "string") {
        destArray = await pdfDoc.getDestination(dest);
      }
      if (Array.isArray(destArray) && destArray[0]) {
        const pageIndex = await pdfDoc.getPageIndex(destArray[0]);
        scrollToPage(pageIndex + 1);
      }
    } catch {
      // Fallback if destination cannot be resolved
    }
  };

  const handleDownloadFile = useCallback(async () => {
    if (!currentPdf) return;
    if (isExcelDoc && excelSheets.length > 0) {
      try {
        const XLSX = await import("xlsx");
        const wb = XLSX.utils.book_new();
        for (const sheet of excelSheets) {
          const ws = XLSX.utils.aoa_to_sheet(sheet.data);
          XLSX.utils.book_append_sheet(wb, ws, sheet.name);
        }
        const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const blob = new Blob([wbout], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = currentPdf.filename.endsWith(".xlsx")
          ? currentPdf.filename
          : `${currentPdf.filename.replace(/\.[^/.]+$/, "")}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        return;
      } catch {
        // Fallback to direct file download
      }
    }
    await downloadFile(currentPdf.url, currentPdf.filename);
  }, [currentPdf, isExcelDoc, excelSheets]);

  if (!isOpen || !currentPdf) return null;

  const pagesArray = Array.from({ length: numPages }, (_, i) => i + 1);

  const hasPagination =
    (isPdfDoc && numPages > 0) ||
    (isWordDoc && numPages > 0) ||
    (isPowerPointDoc && pptxCount > 0);
  const currentIdx = isPdfDoc || isWordDoc ? currentPage : currentSlide;
  const totalCount = isPdfDoc || isWordDoc ? numPages : pptxCount;
  const navLabel = isPdfDoc || isWordDoc ? "page" : "slide";
  const isAtPrevBoundary = hasPagination
    ? isPdfDoc || isWordDoc
      ? currentPage <= 1
      : currentSlide <= 1
    : true;
  const isAtNextBoundary = hasPagination
    ? isPdfDoc || isWordDoc
      ? currentPage >= numPages
      : currentSlide >= pptxCount
    : true;
  const navPrevious = () => {
    if (isPdfDoc || isWordDoc) scrollToPage(currentPage - 1);
    else scrollToSlide(currentSlide - 1);
  };
  const navNext = () => {
    if (isPdfDoc || isWordDoc) scrollToPage(currentPage + 1);
    else scrollToSlide(currentSlide + 1);
  };

  return (
    <div
      role="dialog"
      aria-label={`Document Viewer: ${currentPdf.filename}`}
      aria-modal="true"
      data-testid="pdf-drawer"
      className={cn(
        "absolute inset-0 z-40 flex flex-col bg-background text-foreground",
        "border-l border-border/80 shadow-2xl overflow-hidden",
        "animate-in slide-in-from-right duration-300 ease-out"
      )}
    >
      {/* Top Header */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card/90 px-3 sm:px-4 backdrop-blur-md">
        {/* Left Side: Only the File Name, Brand mark, and mobile Slides toggle */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <FileBrandMark variant={brandVariant} className="size-6 shrink-0" />
          <p
            className="truncate text-sm font-semibold text-foreground leading-normal"
            title={currentPdf.filename}
            data-testid="pdf-drawer-filename"
          >
            {currentPdf.filename}
          </p>
          {isPowerPointDoc && pptxCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPptSidebarOpen(open => !open)}
              data-testid="pptx-mobile-slides-btn"
              aria-label="Toggle slides"
              className="md:hidden h-7 gap-1 rounded-full border-border/80 bg-card px-2 text-xs font-semibold text-foreground shadow-xs hover:bg-accent shrink-0"
            >
              <Presentation className="size-3 text-muted-foreground" />
              <span>Slides</span>
              <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground tabular-nums">
                {currentSlide}/{pptxCount}
              </span>
            </Button>
          )}
        </div>

        {/* Right Side: Edit (text only), Download, then Cancel (only icons, with hover) */}
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Edit Text Button (Text Documents Only) */}
          {isTextDoc &&
            currentPdf?.id &&
            !isLoading &&
            !loadError &&
            textContent !== null && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isEditingText ? "default" : "ghost"}
                    size="icon"
                    onClick={handleEditToggle}
                    data-testid="pdf-drawer-edit-btn"
                    aria-label={isEditingText ? "Done editing" : "Edit text"}
                    className={cn(
                      "size-9 rounded-lg transition-colors",
                      isEditingText
                        ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {isEditingText ? (
                      <Save className="size-4" />
                    ) : (
                      <Pencil className="size-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6}>
                  {isEditingText ? "Done" : "Edit"}
                </TooltipContent>
              </Tooltip>
            )}

          {/* Download Button (Icon Only) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void handleDownloadFile()}
                data-testid="pdf-drawer-download-btn"
                aria-label="Download"
                className="size-9 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Download className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              Download
            </TooltipContent>
          </Tooltip>

          {/* Cancel Option (Icon Only, slightly larger, on the right side) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={closePdf}
                data-testid="pdf-drawer-close-btn"
                aria-label="Close"
                className="size-10 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <X className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              Close (Esc)
            </TooltipContent>
          </Tooltip>
        </div>
      </header>

      {/* Drawer Body: Continuous Document Viewer Area */}
      <div
        className={cn(
          "relative min-h-0 flex-1 w-full overflow-hidden",
          isPowerPointDoc
            ? "flex flex-row bg-neutral-900/10 dark:bg-neutral-950/40"
            : isExcelDoc
              ? "bg-background flex flex-col"
              : "bg-neutral-900/10 dark:bg-neutral-950/40"
        )}
      >
        {/* PowerPoint Left Thumbnail Sidebar:
            - Desktop: standard inline left sidebar
            - Mobile: overlay drawer with backdrop (never pushes slide stage off screen) */}
        {!isLoading && !loadError && isPowerPointDoc && pptxCount > 0 && isPptSidebarOpen && (
          <>
            {/* Mobile Backdrop */}
            <div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden"
              onClick={() => setIsPptSidebarOpen(false)}
              aria-hidden="true"
            />
            {/* Sidebar Container */}
            <div className="fixed inset-y-0 left-0 z-50 h-full md:relative md:z-20 shrink-0">
              <PptSlideSidebar
                canonicalSpec={canonicalSpec}
                slides={pptxSlides}
                currentSlide={currentSlide}
                filename={currentPdf?.filename}
                onSelectSlide={slideNum => {
                  scrollToSlide(slideNum);
                  if (typeof window !== "undefined" && window.innerWidth < 768) {
                    setIsPptSidebarOpen(false);
                  }
                }}
                isOpen={isPptSidebarOpen}
                onClose={() => setIsPptSidebarOpen(false)}
              />
            </div>
          </>
        )}

        {/* PowerPoint Left Collapsed Sidebar Strip (Desktop) */}
        {!isLoading && !loadError && isPowerPointDoc && pptxCount > 0 && !isPptSidebarOpen && (
          <div
            data-testid="pptx-sidebar-collapsed"
            className="hidden md:flex shrink-0 h-full flex-col border-r border-border bg-card/75 dark:bg-card/40 backdrop-blur-sm z-20 py-2.5 px-1.5 items-center select-none transition-all"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsPptSidebarOpen(true)}
                  data-testid="pptx-sidebar-expand-btn"
                  aria-label="Expand sidebar"
                  className="size-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <ChevronsRight className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand sidebar</TooltipContent>
            </Tooltip>
          </div>
        )}

        <div
          ref={scrollContainerRef}
          className={cn(
            "h-full w-full",
            isExcelDoc
              ? "p-0 overflow-hidden flex flex-col"
              : isPowerPointDoc
                ? "flex-1 overflow-y-auto p-2 sm:p-6 md:p-8"
                : "overflow-y-auto p-4 sm:p-6"
          )}
        >
          {isLoading && (
            <div
              className="flex h-full min-h-[300px] flex-col items-center justify-center gap-2.5"
              data-testid="pdf-drawer-loading"
            >
              <div className="loader text-primary" aria-hidden />
            </div>
          )}

          {loadError && !isLoading && (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-destructive">{loadError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void downloadFile(currentPdf.url, currentPdf.filename)
                }
                className="gap-2"
              >
                <Download className="size-4" />
                Download file directly
              </Button>
            </div>
          )}

          {/* PDF Pages Rendering */}
          {!isLoading && !loadError && isPdfDoc && pdfDoc && (
            <div className="mx-auto flex flex-col items-center">
              {pagesArray.map(pageNum => (
                <PdfPageItem
                  key={pageNum}
                  pdfDoc={pdfDoc}
                  pageNumber={pageNum}
                  scale={scale}
                  onNavigateDest={handleNavigateDest}
                  onPageVisible={setCurrentPage}
                />
              ))}
            </div>
          )}

          {/* Word Document (.docx) Rendering as Authentic A4 Pages */}
          {!isLoading && !loadError && isWordDoc && wordHtml && (
            <WordPageViewer
              html={wordHtml}
              scale={scale}
              onPageVisible={setCurrentPage}
              onPageCount={count => {
                if (count > 0) setNumPages(count);
              }}
            />
          )}

          {/* Excel Spreadsheet (.xlsx, .xls, .csv, .tsv) Rendering */}
          {!isLoading && !loadError && isExcelDoc && excelSheets.length > 0 && (
            <ExcelViewer
              sheets={excelSheets}
              scale={scale}
              onSheetsChange={setExcelSheets}
            />
          )}

          {/* PowerPoint Presentation (.pptx, .ppt) Rendering */}
          {!isLoading &&
            !loadError &&
            isPowerPointDoc &&
            pptxCount > 0 &&
            (canonicalSpec ? (
              <PresentationPreview
                spec={canonicalSpec}
                scale={effectivePptScale}
                slideWidth={pptSlideWidth}
                slideHeight={pptSlideHeight}
                filename={currentPdf?.filename}
                onPageVisible={setCurrentSlide}
              />
            ) : (
              <PowerPointViewer
                slides={pptxSlides}
                scale={effectivePptScale}
                slideWidth={pptSlideWidth}
                slideHeight={pptSlideHeight}
                filename={currentPdf?.filename}
                onPageVisible={setCurrentSlide}
              />
            ))}

          {/* Text Document (.txt, .md, .json, etc.) Rendering */}
          {!isLoading &&
            !loadError &&
            isTextDoc &&
            textContent !== null &&
            (isEditingText ? (
              <div
                data-testid="text-document-editor"
                className="mx-auto my-4 flex flex-col bg-white text-neutral-900 dark:bg-card dark:text-foreground shadow-xl border border-border/80 rounded-sm min-h-[600px] transition-transform origin-top"
                style={{
                  maxWidth: "860px",
                  width: "100%",
                  zoom: scale !== 1.0 ? scale : undefined,
                }}
              >
                <textarea
                  data-testid="text-document-editor-textarea"
                  value={draftText}
                  onChange={e => handleTextChange(e.target.value)}
                  spellCheck={false}
                  aria-label="Edit text file"
                  className="w-full flex-1 resize-none bg-transparent px-5 py-4 font-mono text-xs sm:text-[13px] leading-relaxed text-foreground/90 focus:outline-none selection:bg-blue-500/30"
                  style={{ minHeight: "600px" }}
                />
              </div>
            ) : (
              <div
                data-testid="text-document-viewer"
                className="mx-auto my-4 bg-white text-neutral-900 dark:bg-card dark:text-foreground shadow-xl border border-border/80 rounded-sm p-6 sm:p-10 min-h-[600px] select-text selection:bg-blue-500/30 transition-transform origin-top"
                style={{
                  maxWidth: "860px",
                  width: "100%",
                  zoom: scale !== 1.0 ? scale : undefined,
                }}
              >
                <pre className="whitespace-pre-wrap font-mono text-xs sm:text-[13px] leading-relaxed text-foreground/90 font-normal">
                  {textContent}
                </pre>
              </div>
            ))}

          {/* Unsupported Format Fallback */}
          {!isLoading &&
            !loadError &&
            !isPdfDoc &&
            !isWordDoc &&
            !isExcelDoc &&
            !isPowerPointDoc &&
            !isTextDoc && (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  This file format cannot be previewed directly.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void downloadFile(currentPdf.url, currentPdf.filename)
                  }
                  className="gap-2"
                >
                  <Download className="size-4" />
                  Download {currentPdf.filename}
                </Button>
              </div>
            )}
        </div>
        {/* Bottom-Left Pagination Pill */}
        {hasPagination && !isLoading && !loadError && (
          <div
            data-testid="pdf-drawer-pagination-bar"
            className="absolute bottom-4 sm:bottom-5 left-4 z-30 flex items-center gap-0.5 rounded-full border border-border/70 bg-card px-2 py-1 shadow-lg [&_svg]:stroke-[2.5] animate-in fade-in-0 duration-200 select-none"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isAtPrevBoundary}
                  onClick={navPrevious}
                  aria-label={`Previous ${navLabel}`}
                  className="size-9 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Previous {navLabel}</TooltipContent>
            </Tooltip>

            <EditablePageField
              value={currentIdx}
              total={totalCount}
              label={navLabel}
              onNavigate={isPdfDoc || isWordDoc ? scrollToPage : scrollToSlide}
            />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isAtNextBoundary}
                  onClick={navNext}
                  aria-label={`Next ${navLabel}`}
                  className="size-9 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Next {navLabel}</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Bottom-Right Zoom Pill */}
        {!isLoading && !loadError && (
          <div
            data-testid="pdf-drawer-control-bar"
            className="absolute bottom-4 sm:bottom-5 right-4 z-30 flex items-center gap-0.5 rounded-full border border-border/70 bg-card px-2 py-1 shadow-lg [&_svg]:stroke-[2.5] animate-in fade-in-0 duration-200 select-none"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={
                    isPowerPointDoc
                      ? effectivePptScale <= 0.4
                      : scale <= 0.35
                  }
                  onClick={isPowerPointDoc ? handlePptZoomOut : handleZoomOut}
                  aria-label="Zoom out"
                  className="size-9 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <Minus className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Zoom out (-)</TooltipContent>
            </Tooltip>

            {/* Fit / Percentage toggle */}
            <button
              type="button"
              onClick={isPowerPointDoc ? handlePptToggleFit : handleToggleFit}
              className="h-9 min-w-[52px] rounded-lg px-2.5 text-sm font-bold tabular-nums text-muted-foreground transition-colors cursor-pointer hover:bg-accent hover:text-foreground"
            >
              {isPowerPointDoc
                ? isPptFit
                  ? "Fit"
                  : `${Math.round(effectivePptScale * 100)}%`
                : isFit
                  ? "Fit"
                  : `${Math.round(scale * 100)}%`}
            </button>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={
                    isPowerPointDoc
                      ? effectivePptScale >= 2.5
                      : scale >= 2.8
                  }
                  onClick={isPowerPointDoc ? handlePptZoomIn : handleZoomIn}
                  aria-label="Zoom in"
                  className="size-9 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <Plus className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Zoom in (+)</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
});
