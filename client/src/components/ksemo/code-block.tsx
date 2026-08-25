import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, Copy, Download, FileCode2, Maximize2 } from "lucide-react";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { codeToHtml } from "shiki";

/** Blocks longer than this get a capped, scrollable body (expand for full view). */
const COLLAPSED_LINE_LIMIT = 12;
const COLLAPSED_MAX_HEIGHT_PX = 420;

/**
 * Display name + download extension for the languages KSEMO recognises.
 * Anything missing falls back to a neutral "Code" label and .txt.
 */
const LANGUAGE_META: Record<string, { label: string; ext: string }> = {
  python: { label: "Python", ext: "py" },
  py: { label: "Python", ext: "py" },
  javascript: { label: "JavaScript", ext: "js" },
  js: { label: "JavaScript", ext: "js" },
  jsx: { label: "JSX", ext: "jsx" },
  typescript: { label: "TypeScript", ext: "ts" },
  ts: { label: "TypeScript", ext: "ts" },
  tsx: { label: "TSX", ext: "tsx" },
  html: { label: "HTML", ext: "html" },
  css: { label: "CSS", ext: "css" },
  scss: { label: "SCSS", ext: "scss" },
  json: { label: "JSON", ext: "json" },
  java: { label: "Java", ext: "java" },
  c: { label: "C", ext: "c" },
  cpp: { label: "C++", ext: "cpp" },
  "c++": { label: "C++", ext: "cpp" },
  csharp: { label: "C#", ext: "cs" },
  "c#": { label: "C#", ext: "cs" },
  go: { label: "Go", ext: "go" },
  golang: { label: "Go", ext: "go" },
  rust: { label: "Rust", ext: "rs" },
  rs: { label: "Rust", ext: "rs" },
  php: { label: "PHP", ext: "php" },
  sql: { label: "SQL", ext: "sql" },
  bash: { label: "Bash", ext: "sh" },
  sh: { label: "Shell", ext: "sh" },
  shell: { label: "Shell", ext: "sh" },
  zsh: { label: "Zsh", ext: "sh" },
  powershell: { label: "PowerShell", ext: "ps1" },
  ps1: { label: "PowerShell", ext: "ps1" },
  markdown: { label: "Markdown", ext: "md" },
  md: { label: "Markdown", ext: "md" },
  yaml: { label: "YAML", ext: "yml" },
  yml: { label: "YAML", ext: "yml" },
  xml: { label: "XML", ext: "xml" },
  dockerfile: { label: "Dockerfile", ext: "dockerfile" },
  kotlin: { label: "Kotlin", ext: "kt" },
  swift: { label: "Swift", ext: "swift" },
  ruby: { label: "Ruby", ext: "rb" },
  rb: { label: "Ruby", ext: "rb" },
  dart: { label: "Dart", ext: "dart" },
  lua: { label: "Lua", ext: "lua" },
  r: { label: "R", ext: "r" },
  toml: { label: "TOML", ext: "toml" },
  graphql: { label: "GraphQL", ext: "graphql" },
  diff: { label: "Diff", ext: "diff" },
};

function normalizeLanguage(rawLanguage?: string) {
  const id = (rawLanguage ?? "").trim().toLowerCase();
  return { id, known: id.length > 0 && Boolean(LANGUAGE_META[id]) };
}

export function codeBlockLanguageLabel(rawLanguage?: string) {
  const { id, known } = normalizeLanguage(rawLanguage);
  return known ? LANGUAGE_META[id].label : "Code";
}

export function codeBlockDownloadName(rawLanguage?: string) {
  const { id, known } = normalizeLanguage(rawLanguage);
  if (!known) return "code.txt";
  const slug = LANGUAGE_META[id].label.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return `${slug}-code.${LANGUAGE_META[id].ext}`;
}

function LanguageIcon() {
  return <FileCode2 className="size-4 shrink-0" aria-hidden />;
}

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    []
  );

  const copy = useCallback(async () => {
    if (!code || copied) return;
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      try {
        const scratch = document.createElement("textarea");
        scratch.value = code;
        scratch.setAttribute("readonly", "true");
        scratch.style.position = "fixed";
        scratch.style.opacity = "0";
        document.body.appendChild(scratch);
        scratch.select();
        document.execCommand("copy");
        scratch.remove();
      } catch {
        return;
      }
    }
    setCopied(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 2_000);
  }, [code, copied]);

  const label = copied ? "Copied" : "Copy code";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 rounded-md text-muted-foreground hover:bg-foreground/5 hover:text-foreground focus-visible:ring-1"
          onClick={copy}
          disabled={!code}
          aria-label={label}
        >
          {copied ? (
            <Check className="size-3.5" aria-hidden />
          ) : (
            <Copy className="size-3.5" aria-hidden />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function DownloadCodeButton({
  code,
  rawLanguage,
}: {
  code: string;
  rawLanguage?: string;
}) {
  const download = useCallback(() => {
    if (!code) return;
    try {
      const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = codeBlockDownloadName(rawLanguage);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch {
      // Downloading is best-effort; never break the chat over it.
    }
  }, [code, rawLanguage]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 rounded-md text-muted-foreground hover:bg-foreground/5 hover:text-foreground focus-visible:ring-1"
          onClick={download}
          disabled={!code}
          aria-label="Download code"
        >
          <Download className="size-3.5" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Download {codeBlockDownloadName(rawLanguage)}
      </TooltipContent>
    </Tooltip>
  );
}

function ExpandCodeButton({
  onExpand,
  disabled,
}: {
  onExpand: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 rounded-md text-muted-foreground hover:bg-foreground/5 hover:text-foreground focus-visible:ring-1"
          onClick={onExpand}
          disabled={disabled}
          aria-label="Expand code"
        >
          <Maximize2 className="size-3.5" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Expand code</TooltipContent>
    </Tooltip>
  );
}

type CodeBlockActionsProps = {
  code: string;
  rawLanguage?: string;
  onExpand?: () => void;
  expandable?: boolean;
};

function CodeBlockActions({
  code,
  rawLanguage,
  onExpand,
  expandable = false,
}: CodeBlockActionsProps) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <CopyCodeButton code={code} />
      <DownloadCodeButton code={code} rawLanguage={rawLanguage} />
      {expandable && onExpand ? (
        <ExpandCodeButton onExpand={onExpand} disabled={!code} />
      ) : null}
    </div>
  );
}

function CodeSurface({
  code,
  rawLanguage,
  expanded,
}: {
  code: string;
  rawLanguage?: string;
  expanded: boolean;
}) {
  const capped = !expanded && code.split("\n").length > COLLAPSED_LINE_LIMIT;
  const [html, setHtml] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const lang = (rawLanguage ?? "").trim().toLowerCase();
    const validLang = lang && lang in LANGUAGE_META ? lang : "text";

    codeToHtml(code, {
      lang: validLang,
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
    })
      .then(result => {
        if (!cancelled) setHtml(result);
      })
      .catch(() => {
        if (!cancelled) setHtml("");
      });
    return () => {
      cancelled = true;
    };
  }, [code, rawLanguage]);

  return (
    <div
      className="ksemo-code-body overflow-y-auto overscroll-contain"
      style={capped ? { maxHeight: COLLAPSED_MAX_HEIGHT_PX } : undefined}
    >
      {html ? (
        <div
          className="[&>pre]:m-0 [&>pre]:bg-transparent [&>pre]:p-4"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre data-code-pre="plain">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

function KsemoCodeBlockHeader({
  code,
  rawLanguage,
  expandable,
  onExpand,
}: {
  code: string;
  rawLanguage?: string;
  expandable: boolean;
  onExpand?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-2.5 pb-1 pt-1.5">
      <span className="flex min-w-0 items-center gap-1.5 font-mono text-[11px] lowercase tracking-wide text-muted-foreground">
        <LanguageIcon />
        <span className="truncate">{codeBlockLanguageLabel(rawLanguage)}</span>
      </span>
      <CodeBlockActions
        code={code}
        rawLanguage={rawLanguage}
        expandable={expandable}
        onExpand={onExpand}
      />
    </div>
  );
}

export function KsemoCodeBlock({
  code,
  rawLanguage,
}: {
  code: string;
  rawLanguage?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const expandable = code.split("\n").length > COLLAPSED_LINE_LIMIT;

  useEffect(() => {
    if (!expandable) setExpanded(false);
  }, [expandable]);

  const block = (
    <div className="my-4 w-full overflow-hidden rounded-xl border border-border/70">
      <KsemoCodeBlockHeader
        code={code}
        rawLanguage={rawLanguage}
        expandable={expandable}
        onExpand={() => setExpanded(true)}
      />
      <CodeSurface code={code} rawLanguage={rawLanguage} expanded={false} />
    </div>
  );

  return (
    <>
      {block}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent
          className="flex h-[86vh] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">
            Expanded {codeBlockLanguageLabel(rawLanguage).toLowerCase()} code
          </DialogTitle>
          <DialogDescription className="sr-only">
            Full view of the code snippet with copy and download actions.
          </DialogDescription>
          <KsemoCodeBlockHeader
            code={code}
            rawLanguage={rawLanguage}
            expandable={false}
          />
          <div className="min-h-0 flex-1">
            <CodeSurface code={code} rawLanguage={rawLanguage} expanded />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

const FENCE_LANGUAGE_PATTERN = /language-([\w+#.-]+)/;

function flattenCodeChildren(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children))
    return children.map(child => flattenCodeChildren(child)).join("");
  if (
    React.isValidElement(children) &&
    typeof children.props === "object" &&
    children.props !== null &&
    "children" in children.props
  ) {
    return flattenCodeChildren(
      (children.props as { children?: React.ReactNode }).children
    );
  }
  return "";
}

/**
 * Drop-in replacement for Streamdown's `code` element. Inline code keeps the
 * original pill styling; fenced blocks become the full KSEMO Code Block.
 */
type MarkdownCodeElementProps = React.ClassAttributes<HTMLElement> &
  React.HTMLAttributes<HTMLElement> & { node?: unknown };

function KsemoMarkdownCodeInner({
  node,
  className,
  children,
  ...htmlAttributes
}: MarkdownCodeElementProps) {
  void node;
  const position = (
    node as
      | { position?: { start?: { line?: number }; end?: { line?: number } } }
      | undefined
  )?.position;
  const isInline =
    position?.start?.line !== undefined &&
    position?.end?.line !== undefined &&
    position.start.line === position.end.line;

  if (isInline) {
    return (
      <code
        className={cn(
          "rounded-md border border-border/70 bg-muted/70 px-1.5 py-0.5 font-mono text-[13px]",
          className
        )}
        data-streamdown="inline-code"
        {...htmlAttributes}
      >
        {children}
      </code>
    );
  }

  const match = className?.match(FENCE_LANGUAGE_PATTERN);
  const rawLanguage = match?.[1];
  const code = flattenCodeChildren(children).replace(/\n$/, "");

  return <KsemoCodeBlock code={code} rawLanguage={rawLanguage} />;
}

export const KsemoMarkdownCode = memo(KsemoMarkdownCodeInner);
