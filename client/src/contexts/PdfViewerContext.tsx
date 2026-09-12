import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type PdfViewerFile = {
  url: string;
  filename: string;
  sizeBytes?: number;
  mimeType?: string;
};

export type DocumentViewerFile = PdfViewerFile;

export interface PdfViewerContextType {
  currentPdf: PdfViewerFile | null;
  currentDocument: DocumentViewerFile | null;
  isOpen: boolean;
  openPdf: (file: PdfViewerFile) => void;
  openDocument: (file: DocumentViewerFile) => void;
  closePdf: () => void;
  closeDocument: () => void;
}

export function isPdf(filename?: string, mimeType?: string): boolean {
  if (mimeType === "application/pdf") return true;
  if (!filename) return false;
  return /\.pdf$/i.test(filename.trim());
}

export function isWord(filename?: string, mimeType?: string): boolean {
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    return true;
  }
  if (!filename) return false;
  return /\.(docx|doc)$/i.test(filename.trim());
}

export function isExcel(filename?: string, mimeType?: string): boolean {
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "text/csv" ||
    mimeType === "text/tab-separated-values"
  ) {
    return true;
  }
  if (!filename) return false;
  return /\.(xlsx|xls|csv|tsv)$/i.test(filename.trim());
}

export function isPowerPoint(filename?: string, mimeType?: string): boolean {
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mimeType === "application/vnd.ms-powerpoint"
  ) {
    return true;
  }
  if (!filename) return false;
  return /\.(pptx|ppt)$/i.test(filename.trim());
}

export function isText(filename?: string, mimeType?: string): boolean {
  if (mimeType?.startsWith("text/") || mimeType === "application/json") {
    return true;
  }
  if (!filename) return false;
  return /\.(txt|md|markdown|json|log|xml|yml|yaml|js|ts|jsx|tsx|py|sql|sh|html|css|env|toml|ini)$/i.test(
    filename.trim()
  );
}

export function isViewableDocument(filename?: string, mimeType?: string): boolean {
  return (
    isPdf(filename, mimeType) ||
    isWord(filename, mimeType) ||
    isExcel(filename, mimeType) ||
    isPowerPoint(filename, mimeType) ||
    isText(filename, mimeType)
  );
}

const PdfViewerContext = createContext<PdfViewerContextType | undefined>(
  undefined
);

export function PdfViewerProvider({
  children,
  initialPdf = null,
  initialOpen = false,
}: {
  children?: React.ReactNode;
  initialPdf?: PdfViewerFile | null;
  initialOpen?: boolean;
}) {
  const [currentPdf, setCurrentPdf] = useState<PdfViewerFile | null>(initialPdf);
  const [isOpen, setIsOpen] = useState(initialOpen);

  const openPdf = useCallback((file: PdfViewerFile) => {
    setCurrentPdf(file);
    setIsOpen(true);
  }, []);

  const closePdf = useCallback(() => {
    setIsOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      currentPdf,
      currentDocument: currentPdf,
      isOpen,
      openPdf,
      openDocument: openPdf,
      closePdf,
      closeDocument: closePdf,
    }),
    [currentPdf, isOpen, openPdf, closePdf]
  );

  return (
    <PdfViewerContext.Provider value={value}>
      {children}
    </PdfViewerContext.Provider>
  );
}

export function usePdfViewer(): PdfViewerContextType {
  const context = useContext(PdfViewerContext);
  if (!context) {
    return {
      currentPdf: null,
      currentDocument: null,
      isOpen: false,
      openPdf: () => {},
      openDocument: () => {},
      closePdf: () => {},
      closeDocument: () => {},
    };
  }
  return context;
}
