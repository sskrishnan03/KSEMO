import React, {
  memo,
  useCallback,
  useEffect,
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
import { FileBrandMark, brandVariantForExt } from "./FileBrandIcons";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Minus,
  Plus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getDocumentProxy } from "unpdf";

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
          const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
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
      className="relative mb-6 rounded-sm bg-white text-black shadow-xl border border-black/10 overflow-hidden mx-auto transition-transform"
    >
      {isRendering && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-xs">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
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
      items: items.length > 0 ? items : [{ text: `Slide ${i + 1}`, isTitle: true }],
    });
  }

  return slides;
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
  } | null>({
    row: 0,
    col: 0,
    coord: "A1",
    value: sheets[0]?.data?.[0]?.[0] ?? "",
  });

  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [selectedCol, setSelectedCol] = useState<number | null>(null);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const cellInputRef = useRef<HTMLInputElement | null>(null);

  const currentSheet = localSheets[activeSheetIdx] || { name: "Sheet1", data: [] };
  const maxColsInSheet = currentSheet.data.reduce(
    (max, r) => Math.max(max, Array.isArray(r) ? r.length : 0),
    0
  );
  const numCols = Math.max(maxColsInSheet + 4, 16);
  const numRows = Math.max(currentSheet.data.length + 10, 36);

  const colHeaders = Array.from({ length: numCols }, (_, i) => getColumnLetter(i));
  const rowIndices = Array.from({ length: numRows }, (_, i) => i);

  // Update cell value helper
  const updateCellValue = useCallback(
    (sheetIdx: number, rIdx: number, cIdx: number, val: string) => {
      setLocalSheets(prev => {
        const next = prev.map((s, idx) => {
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
        onSheetsChange?.(next);
        return next;
      });
    },
    [onSheetsChange]
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
      setSelectedCol(null);
      setSelectedRow(null);
    },
    [currentSheet]
  );

  // Handle cell click
  const handleCellClick = (rIdx: number, cIdx: number, currentVal: any) => {
    if (selectedCell?.row === rIdx && selectedCell?.col === cIdx) {
      setEditingCell({ row: rIdx, col: cIdx });
      setEditValue(String(currentVal ?? ""));
    } else {
      setSelectedCell({
        row: rIdx,
        col: cIdx,
        coord: `${getColumnLetter(cIdx)}${rIdx + 1}`,
        value: currentVal ?? "",
      });
      setSelectedCol(null);
      setSelectedRow(null);
      setEditingCell(null);
    }
  };

  // Handle cell double click
  const handleCellDoubleClick = (rIdx: number, cIdx: number, currentVal: any) => {
    setSelectedCell({
      row: rIdx,
      col: cIdx,
      coord: `${getColumnLetter(cIdx)}${rIdx + 1}`,
      value: currentVal ?? "",
    });
    setEditingCell({ row: rIdx, col: cIdx });
    setEditValue(String(currentVal ?? ""));
  };

  // Add new row at bottom
  const handleAddRow = () => {
    setLocalSheets(prev => {
      const next = [...prev];
      const sheet = { ...next[activeSheetIdx] };
      const data = sheet.data.map(r => (Array.isArray(r) ? [...r] : []));
      data.push(new Array(numCols).fill(""));
      sheet.data = data;
      next[activeSheetIdx] = sheet;
      onSheetsChange?.(next);
      return next;
    });
  };

  // Add new column at right
  const handleAddCol = () => {
    setLocalSheets(prev => {
      const next = [...prev];
      const sheet = { ...next[activeSheetIdx] };
      const data = sheet.data.map(r => (Array.isArray(r) ? [...r, ""] : [""]));
      sheet.data = data;
      next[activeSheetIdx] = sheet;
      onSheetsChange?.(next);
      return next;
    });
  };

  // Add new sheet
  const handleAddNewSheet = () => {
    const newName = `Sheet${localSheets.length + 1}`;
    const newSheet: ExcelSheetData = { name: newName, data: [] };
    const next = [...localSheets, newSheet];
    setLocalSheets(next);
    onSheetsChange?.(next);
    setActiveSheetIdx(localSheets.length);
    setSelectedCell({ row: 0, col: 0, coord: "A1", value: "" });
    setEditingCell(null);
    setSelectedCol(null);
    setSelectedRow(null);
  };

  // Keyboard navigation & direct typing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingCell) return;
      if (!selectedCell) return;

      const { row, col } = selectedCell;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectCell(Math.min(row + 1, numRows - 1), col);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectCell(Math.max(row - 1, 0), col);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        selectCell(row, Math.min(col + 1, numCols - 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        selectCell(row, Math.max(col - 1, 0));
      } else if (e.key === "Enter" || e.key === "F2") {
        e.preventDefault();
        setEditingCell({ row, col });
        setEditValue(String(selectedCell.value ?? ""));
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        updateCellValue(activeSheetIdx, row, col, "");
        setSelectedCell(prev => (prev ? { ...prev, value: "" } : null));
      } else if (
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        e.key !== "Tab"
      ) {
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
    selectCell,
    updateCellValue,
  ]);

  return (
    <div
      data-testid="excel-document-viewer"
      className="flex flex-col h-full w-full bg-background overflow-hidden select-none"
    >
      {/* Excel Formula Bar */}
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground font-mono select-none shrink-0">
        {/* Active Cell Coordinate */}
        <span className="w-16 shrink-0 font-bold text-foreground text-center bg-card py-1 rounded border border-border shadow-2xs">
          {selectedCell ? selectedCell.coord : "A1"}
        </span>

        {/* fx formula indicator */}
        <span className="text-muted-foreground/70 italic font-serif text-sm font-semibold px-0.5 select-none">
          fx
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
              updateCellValue(activeSheetIdx, selectedCell.row, selectedCell.col, val);
              setSelectedCell(prev => (prev ? { ...prev, value: val } : null));
            }
          }}
          onFocus={() => {
            if (selectedCell && !editingCell) {
              setEditingCell({ row: selectedCell.row, col: selectedCell.col });
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
          className="flex-1 px-2.5 py-1 bg-background rounded border border-border text-foreground font-sans text-xs outline-hidden focus:ring-1 focus:ring-emerald-600 transition-all placeholder:text-muted-foreground/40"
        />

        {/* Quick Add Row & Column buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleAddRow}
            title="Add row at bottom"
            className="px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-card rounded border border-border/80 transition-colors cursor-pointer"
          >
            + Row
          </button>
          <button
            type="button"
            onClick={handleAddCol}
            title="Add column at right"
            className="px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-card rounded border border-border/80 transition-colors cursor-pointer"
          >
            + Col
          </button>
        </div>
      </div>

      {/* Spreadsheet Grid Table */}
      <div className="flex-1 overflow-auto bg-background select-none">
        <div style={{ zoom: scale !== 1.0 ? scale : undefined, minWidth: "100%" }}>
          <table className="border-collapse text-xs text-foreground min-w-full table-fixed">
            <thead>
              <tr className="sticky top-0 z-20 bg-muted/95 backdrop-blur-xs border-b border-border shadow-2xs">
                {/* Top-left blank cell */}
                <th className="sticky left-0 z-30 w-12 min-w-[48px] bg-muted border-r border-b border-border text-center font-normal text-muted-foreground/40 py-1" />
                {colHeaders.map((col, idx) => {
                  const isColSelected = selectedCol === idx;
                  return (
                    <th
                      key={idx}
                      onClick={() => {
                        setSelectedCol(idx);
                        setSelectedRow(null);
                        selectCell(0, idx);
                      }}
                      className={cn(
                        "w-[120px] min-w-[100px] border-r border-border px-2 py-1 text-center text-xs font-semibold cursor-pointer transition-colors select-none",
                        isColSelected
                          ? "bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 font-bold border-b-2 border-b-emerald-600"
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
                const isRowSelected = selectedRow === rIdx;
                return (
                  <tr key={rIdx} className="hover:bg-muted/15">
                    {/* Sticky Row Number */}
                    <th
                      onClick={() => {
                        setSelectedRow(rIdx);
                        setSelectedCol(null);
                        selectCell(rIdx, 0);
                      }}
                      className={cn(
                        "sticky left-0 z-10 w-12 min-w-[48px] border-r border-b border-border px-2 py-1 text-right font-mono text-[11px] font-normal cursor-pointer select-none transition-colors",
                        isRowSelected
                          ? "bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 font-bold border-r-2 border-r-emerald-600"
                          : "bg-muted/80 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {rIdx + 1}
                    </th>
                    {colHeaders.map((_, cIdx) => {
                      const val = rowData[cIdx] !== undefined ? rowData[cIdx] : "";
                      const isSelected =
                        selectedCell?.row === rIdx && selectedCell?.col === cIdx;
                      const isEditing =
                        editingCell?.row === rIdx && editingCell?.col === cIdx;
                      const isInSelectedCol = selectedCol === cIdx;
                      const isInSelectedRow = selectedRow === rIdx;

                      return (
                        <td
                          key={cIdx}
                          onClick={() => handleCellClick(rIdx, cIdx, val)}
                          onDoubleClick={() => handleCellDoubleClick(rIdx, cIdx, val)}
                          className={cn(
                            "w-[120px] min-w-[100px] border-r border-b border-border/60 px-2 py-1 text-xs truncate cursor-cell transition-colors relative",
                            isInSelectedCol || isInSelectedRow ? "bg-emerald-500/5" : "",
                            isSelected
                              ? "ring-2 ring-emerald-600 ring-inset bg-emerald-500/15 font-medium z-10"
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
                              onChange={e => {
                                const newVal = e.target.value;
                                setEditValue(newVal);
                                updateCellValue(activeSheetIdx, rIdx, cIdx, newVal);
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
                              className="w-full h-full bg-background text-foreground font-sans text-xs px-1 py-0 outline-hidden ring-2 ring-emerald-600 ring-inset"
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

      {/* Excel Sheet Tabs Footer & Status Bar */}
      <div className="flex items-center justify-between border-t border-border bg-muted/40 px-3 py-1.5 text-xs shrink-0 select-none">
        {/* Sheet Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto max-w-[65%] py-0.5">
          {localSheets.map((sheet, sIdx) => {
            const isActive = sIdx === activeSheetIdx;
            return (
              <button
                key={sIdx}
                type="button"
                onClick={() => {
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
                }}
                className={cn(
                  "px-3.5 py-1 text-xs font-semibold rounded-t-md transition-all cursor-pointer whitespace-nowrap",
                  isActive
                    ? "bg-background text-emerald-600 dark:text-emerald-400 border-t-2 border-t-emerald-600 border-x border-border shadow-xs font-bold"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                )}
              >
                {sheet.name}
              </button>
            );
          })}
          {/* Add Sheet button */}
          <button
            type="button"
            onClick={handleAddNewSheet}
            title="Add new sheet"
            className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-background border border-transparent hover:border-border transition-colors cursor-pointer"
          >
            <Plus className="size-3.5" />
          </button>
        </div>

        {/* Status indicator (with pr-36 so it doesn't collide with zoom controls) */}
        <div className="flex items-center gap-2.5 text-[11px] font-medium text-muted-foreground pr-36 select-none">
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Ready</span>
          <span>•</span>
          <span>{currentSheet.data.length} rows</span>
          <span>•</span>
          <span>{numCols} cols</span>
        </div>
      </div>
    </div>
  );
});

const PowerPointViewer = memo(function PowerPointViewer({
  slides,
  scale,
}: {
  slides: SlideData[];
  scale: number;
}) {
  return (
    <div
      data-testid="powerpoint-document-viewer"
      className="mx-auto flex flex-col items-center gap-8 py-4 w-full"
    >
      {slides.map(slide => (
        <div
          key={slide.slideNumber}
          data-testid={`pptx-slide-${slide.slideNumber}`}
          data-slide={slide.slideNumber}
          className="aspect-[16/9] w-full max-w-[850px] min-h-[460px] bg-white text-neutral-900 shadow-2xl rounded-2xl border border-neutral-200/80 p-8 sm:p-14 flex flex-col justify-between select-text transition-transform relative overflow-hidden"
          style={{ zoom: scale !== 1.0 ? scale : undefined }}
        >
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="h-1.5 w-6 rounded-full bg-orange-500" />
              <span className="text-xs uppercase tracking-widest font-semibold text-neutral-400">
                Slide {slide.slideNumber}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 leading-snug">
              {slide.title}
            </h2>
          </div>

          {/* Body */}
          <div className="my-6 space-y-3.5 flex-1 flex flex-col justify-center">
            {slide.items
              .filter(it => !it.isTitle)
              .map((item, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <span className="size-2 rounded-full bg-orange-500/80 mt-2 shrink-0" />
                  <p className="text-sm sm:text-base text-neutral-700 leading-relaxed font-normal">
                    {item.text}
                  </p>
                </div>
              ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-neutral-100 pt-3 text-xs text-neutral-400 font-medium select-none">
            <span>PowerPoint Presentation</span>
            <span>
              {slide.slideNumber} of {slides.length}
            </span>
          </div>
        </div>
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
  const [currentSlide, setCurrentSlide] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Zoom management
  const [scale, setScale] = useState<number>(1.0);
  const [isFit, setIsFit] = useState<boolean>(true);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const basePageWidthRef = useRef<number>(600);

  const isPdfDoc = currentPdf ? isPdf(currentPdf.filename, currentPdf.mimeType) : false;
  const isWordDoc = currentPdf ? isWord(currentPdf.filename, currentPdf.mimeType) : false;
  const isExcelDoc = currentPdf ? isExcel(currentPdf.filename, currentPdf.mimeType) : false;
  const isPowerPointDoc = currentPdf ? isPowerPoint(currentPdf.filename, currentPdf.mimeType) : false;
  const isTextDoc = currentPdf ? isText(currentPdf.filename, currentPdf.mimeType) : false;
  const ext = currentPdf?.filename.split(".").pop() || "";
  const brandVariant = brandVariantForExt(ext);

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

  // Load Document (PDF, Word, Excel, PowerPoint, or Text) in-project
  useEffect(() => {
    if (!isOpen || !currentPdf?.url) {
      setPdfDoc(null);
      setWordHtml(null);
      setTextContent(null);
      setExcelSheets([]);
      setPptxSlides([]);
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
    setPdfDoc(null);
    setWordHtml(null);
    setTextContent(null);
    setExcelSheets([]);
    setPptxSlides([]);

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
      const base = basePageWidthRef.current > 0 ? basePageWidthRef.current : 800;
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
        setIsFit(false);
        const zoomDelta = e.deltaY < 0 ? 0.08 : -0.08;
        setScale(prev => Math.min(Math.max(Number((prev + zoomDelta).toFixed(2)), 0.25), 3.0));
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [isOpen]);

  // Scroll to a specific PowerPoint slide
  const scrollToSlide = useCallback((slideNum: number) => {
    if (!scrollContainerRef.current) return;
    const target = scrollContainerRef.current.querySelector(
      `[data-slide="${slideNum}"]`
    );
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setCurrentSlide(slideNum);
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
      if (activeTag === "input" || activeTag === "textarea" || target?.isContentEditable) return;

      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      if (
        (isCtrlOrCmd && (event.key === "=" || event.key === "+")) ||
        (!isCtrlOrCmd && (event.key === "+" || event.key === "="))
      ) {
        event.preventDefault();
        handleZoomIn();
      } else if (
        (isCtrlOrCmd && (event.key === "-" || event.key === "_")) ||
        (!isCtrlOrCmd && (event.key === "-" || event.key === "_"))
      ) {
        event.preventDefault();
        handleZoomOut();
      } else if (isCtrlOrCmd && (event.key === "0" || event.key === "Digit0")) {
        event.preventDefault();
        handleToggleFit();
      }

      // PowerPoint slide arrow key navigation
      if (isPowerPointDoc && pptxSlides.length > 0) {
        if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "PageDown") {
          event.preventDefault();
          if (currentSlide < pptxSlides.length) {
            scrollToSlide(currentSlide + 1);
          }
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "PageUp") {
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
    isPowerPointDoc,
    pptxSlides.length,
    currentSlide,
    scrollToSlide,
  ]);

  // Scroll to a specific page
  const scrollToPage = (pageNum: number) => {
    if (!scrollContainerRef.current) return;
    const target = scrollContainerRef.current.querySelector(
      `[data-page="${pageNum}"]`
    );
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setCurrentPage(pageNum);
    }
  };

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
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/90 px-3 sm:px-4 backdrop-blur-md gap-3">
        {/* Left Side: Only the File Name and Brand mark (no subtitles, no file size) */}
        <div className="flex items-center gap-2.5 min-w-0">
          <FileBrandMark variant={brandVariant} className="size-6 shrink-0" />
          <p
            className="truncate text-sm font-semibold text-foreground leading-normal"
            title={currentPdf.filename}
            data-testid="pdf-drawer-filename"
          >
            {currentPdf.filename}
          </p>
        </div>

        {/* Right Side: Download Option, then Cancel Option (only icons, with hover) */}
        <div className="flex shrink-0 items-center gap-1.5">
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
          isExcelDoc
            ? "bg-background flex flex-col"
            : "bg-neutral-900/10 dark:bg-neutral-950/40"
        )}
      >
        <div
          ref={scrollContainerRef}
          className={cn(
            "h-full w-full",
            isExcelDoc
              ? "p-0 overflow-hidden flex flex-col"
              : "overflow-y-auto p-4 sm:p-6"
          )}
        >
          {isLoading && (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-2.5">
              <Loader2 className="size-7 animate-spin text-primary" />
              <p className="text-xs font-medium text-muted-foreground">
                Loading document...
              </p>
            </div>
          )}

          {loadError && !isLoading && (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-destructive">{loadError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void downloadFile(currentPdf.url, currentPdf.filename)}
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

          {/* Word Document (.docx) Rendering as Authentic A4 Sheet */}
          {!isLoading && !loadError && isWordDoc && wordHtml && (
            <div
              data-testid="word-document-viewer"
              className="mx-auto my-6 bg-white text-neutral-900 shadow-2xl rounded-xs border border-neutral-300/80 p-12 sm:p-16 min-h-[1123px] select-text selection:bg-blue-500/30 transition-transform origin-top word-document-content font-sans relative"
              style={{
                width: "794px",
                maxWidth: "100%",
                zoom: scale !== 1.0 ? scale : undefined,
              }}
            >
              {/* Authentic A4 Sheet Header Marker */}
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3 mb-8 text-[11px] text-neutral-400 font-medium uppercase tracking-wider select-none">
                <span>Document</span>
                <span>Page 1</span>
              </div>

              <div
                className="space-y-4 text-neutral-800 leading-relaxed [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-neutral-900 [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-neutral-900 [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-neutral-900 [&_h3]:mb-2 [&_p]:mb-3.5 [&_p]:text-[14.5px] [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-3.5 [&_li]:mb-1 [&_table]:w-full [&_table]:border-collapse [&_table]:border [&_table]:border-neutral-300 [&_table]:my-4 [&_th]:border [&_th]:border-neutral-300 [&_th]:bg-neutral-50 [&_th]:px-3.5 [&_th]:py-2 [&_th]:text-xs [&_th]:font-semibold [&_th]:text-left [&_td]:border [&_td]:border-neutral-300 [&_td]:px-3.5 [&_td]:py-2 [&_td]:text-xs [&_blockquote]:border-l-4 [&_blockquote]:border-blue-500 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-3.5 [&_blockquote]:text-neutral-600 [&_a]:text-blue-600 [&_a]:underline [&_a]:underline-offset-2 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_img]:my-3"
                dangerouslySetInnerHTML={{ __html: wordHtml }}
              />

              {/* Authentic A4 Sheet Footer Marker */}
              <div className="border-t border-neutral-200 pt-4 mt-12 text-center text-[11px] text-neutral-400 font-medium select-none">
                <span>Page 1</span>
              </div>
            </div>
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
          {!isLoading && !loadError && isPowerPointDoc && pptxSlides.length > 0 && (
            <PowerPointViewer
              slides={pptxSlides}
              scale={scale}
            />
          )}

          {/* Text Document (.txt, .md, .json, etc.) Rendering */}
          {!isLoading && !loadError && isTextDoc && textContent !== null && (
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
          )}

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
                  onClick={() => void downloadFile(currentPdf.url, currentPdf.filename)}
                  className="gap-2"
                >
                  <Download className="size-4" />
                  Download {currentPdf.filename}
                </Button>
              </div>
            )}
        </div>

        {/* Bottom Left Floating Page/Slide Indicator (Compact) */}
        {!isLoading && !loadError && (
          <>
            {/* PDF Page Indicator */}
            {isPdfDoc && numPages > 0 && (
              <div
                data-testid="pdf-drawer-page-indicator"
                className="absolute bottom-4 left-4 z-30 flex items-center gap-1 rounded-xl border border-border/80 bg-card/90 px-2 py-1 text-xs font-medium text-foreground shadow-lg backdrop-blur-md animate-in fade-in-0 duration-200"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={currentPage <= 1}
                      onClick={() => scrollToPage(currentPage - 1)}
                      aria-label="Previous page"
                      className="size-7 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Previous page</TooltipContent>
                </Tooltip>

                <span className="px-1.5 tabular-nums text-xs select-none">
                  <strong className="text-foreground font-semibold">{currentPage}</strong>
                  <span className="text-muted-foreground/60 mx-1">/</span>
                  <span className="text-muted-foreground">{numPages}</span>
                </span>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={currentPage >= numPages}
                      onClick={() => scrollToPage(currentPage + 1)}
                      aria-label="Next page"
                      className="size-7 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Next page</TooltipContent>
                </Tooltip>
              </div>
            )}

            {/* PowerPoint Slide Indicator */}
            {isPowerPointDoc && pptxSlides.length > 0 && (
              <div
                data-testid="pdf-drawer-slide-indicator"
                className="absolute bottom-4 left-4 z-30 flex items-center gap-1 rounded-xl border border-border/80 bg-card/90 px-2 py-1 text-xs font-medium text-foreground shadow-lg backdrop-blur-md animate-in fade-in-0 duration-200"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={currentSlide <= 1}
                      onClick={() => scrollToSlide(currentSlide - 1)}
                      aria-label="Previous slide"
                      className="size-7 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Previous slide</TooltipContent>
                </Tooltip>

                <span className="px-1.5 tabular-nums text-xs select-none">
                  <strong className="text-foreground font-semibold">Slide {currentSlide}</strong>
                  <span className="text-muted-foreground/60 mx-1">/</span>
                  <span className="text-muted-foreground">{pptxSlides.length}</span>
                </span>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={currentSlide >= pptxSlides.length}
                      onClick={() => scrollToSlide(currentSlide + 1)}
                      aria-label="Next slide"
                      className="size-7 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Next slide</TooltipContent>
                </Tooltip>
              </div>
            )}
          </>
        )}

        {/* Bottom Right Floating Zoom Controls (+ / - and Scale) */}
        {!isLoading && !loadError && (
          <div
            data-testid="pdf-drawer-zoom-controls"
            className={cn(
              "absolute z-30 flex items-center gap-1.5 animate-in fade-in-0 duration-200 select-none",
              isExcelDoc
                ? "bottom-1.5 right-3 rounded-lg border border-border/80 bg-card/95 px-2 py-0.5 text-xs shadow-xs"
                : "bottom-4 sm:bottom-5 right-4 sm:right-5 rounded-2xl border border-border/80 bg-card/95 px-2.5 py-1.5 text-sm font-medium shadow-xl backdrop-blur-md"
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={scale <= 0.35}
                  onClick={handleZoomOut}
                  aria-label="Zoom out"
                  className={cn(
                    "rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 transition-colors",
                    isExcelDoc ? "size-6" : "size-8 sm:size-9 sm:rounded-xl"
                  )}
                >
                  <Minus className={isExcelDoc ? "size-3.5" : "size-4 sm:size-4.5"} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Zoom out (-)</TooltipContent>
            </Tooltip>

            <button
              type="button"
              onClick={handleToggleFit}
              title="Click to toggle Fit / 100%"
              className={cn(
                "tabular-nums font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/60 rounded transition-colors cursor-pointer select-none",
                isExcelDoc ? "px-1.5 py-0.5 text-xs min-w-[42px]" : "px-2.5 py-1 text-sm min-w-[52px] rounded-lg"
              )}
            >
              {isFit ? "Fit" : `${Math.round(scale * 100)}%`}
            </button>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={scale >= 2.8}
                  onClick={handleZoomIn}
                  aria-label="Zoom in"
                  className={cn(
                    "rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 transition-colors",
                    isExcelDoc ? "size-6" : "size-8 sm:size-9 sm:rounded-xl"
                  )}
                >
                  <Plus className={isExcelDoc ? "size-3.5" : "size-4 sm:size-4.5"} />
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
