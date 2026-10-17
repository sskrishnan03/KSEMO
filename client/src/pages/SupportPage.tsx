import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThinkingIndicator } from "@/components/ui/thinking-indicator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  ASSISTANT_SUGGESTIONS,
  answerFromFaq,
  FAQ_CATEGORIES,
  searchFaq,
  type FaqItem,
} from "@/lib/supportContent";
import {
  ArrowLeft,
  ArrowUp,
  Bot,
  ChevronDown,
  ChevronRight,
  FileText,
  HelpCircle,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

type SupportTopic = "faq" | "privacy" | "terms";

export function FaqHelpDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [view, setView] = useState<"home" | "faq">("home");
  const [chatStarted, setChatStarted] = useState(false);
  const [chatSession, setChatSession] = useState(0);
  useEffect(() => {
    if (!open) return;
    setView("home");
    setChatStarted(false);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed right-2 top-2 bottom-2 z-[120] flex h-[calc(100dvh-1rem)] w-[min(calc(100vw-1rem),27rem)] flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-lg animate-in slide-in-from-right-3 fade-in duration-200">
      <aside
        role="dialog"
        aria-labelledby="help-drawer-title"
        className="flex min-h-0 flex-1 flex-col"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-border/70 bg-muted/10 px-3.5 py-2.5">
          {view === "faq" ? (
            <Button type="button" variant="ghost" size="icon" onClick={() => setView("home")} aria-label="Back to help" className="size-9 rounded-lg">
              <ArrowLeft className="size-4" />
            </Button>
          ) : chatStarted ? (
            <Button type="button" variant="ghost" size="icon" onClick={() => { setChatStarted(false); setChatSession(session => session + 1); }} aria-label="Back to help" className="size-9 rounded-lg">
              <ArrowLeft className="size-4" />
            </Button>
          ) : null}
          <span className="ml-2 mr-auto text-base font-semibold tracking-tight">KSEMO</span>
          <h2 id="help-drawer-title" className="sr-only">{view === "home" ? (chatStarted ? "Chat with help" : "Get help") : "Frequently asked questions"}</h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close help" className="size-9 rounded-lg">
            <X className="size-4" />
          </Button>
        </header>
        {view === "home" ? (
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
            {!chatStarted && (
              <div className="flex min-h-0 flex-1 flex-col justify-center py-5 text-center">
                <HelpCircle className="mx-auto mb-2 size-6 text-muted-foreground" />
                <h3 className="text-2xl font-semibold leading-tight tracking-[-0.025em]">How can we help?</h3>
                <p className="mt-2 text-sm leading-5 text-muted-foreground">Search FAQs or ask KSEMO a question.</p>
              </div>
            )}
            {!chatStarted && <button type="button" onClick={() => setView("faq")} className="mx-auto mb-2 flex w-full max-w-sm shrink-0 items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground"><Search className="size-4.5" /></span>
                <span className="min-w-0"><span className="block text-sm font-semibold">Frequently asked questions</span><span className="mt-0.5 block text-xs text-muted-foreground">Search common questions by topic</span></span>
                <ChevronRight className="ml-auto size-4 text-muted-foreground" />
            </button>}
            <div className={cn("flex min-h-0 flex-col", chatStarted ? "flex-1" : "shrink-0")}>
              <HelpChat key={chatSession} onStartChat={() => setChatStarted(true)} activeChat={chatStarted} />
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
            <FaqContent compact />
          </div>
        )}
      </aside>
    </div>
  );
}

function HelpChat({ onStartChat, activeChat }: { onStartChat: () => void; activeChat: boolean }) {
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Array<{ id: number; role: "user" | "assistant"; content: string; related?: FaqItem[] }>>([]);
  const [thinking, setThinking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  useEffect(() => {
    if (!suggestionsOpen) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !pickerRef.current?.contains(event.target)) {
        setSuggestionsOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [suggestionsOpen]);

  function send(questionDraft: string) {
    const question = questionDraft.trim();
    if (!question || thinking) return;
    onStartChat();
    setSuggestionsOpen(false);
    setMessages(current => [...current, { id: nextId.current++, role: "user", content: question }]);
    setThinking(true);
    window.setTimeout(() => {
      const reply = answerFromFaq(question);
      const isHelpQuestion = !reply.answer.startsWith("Could you rephrase that?") &&
        !reply.answer.startsWith("I could not find a confident answer");
      const matchingSections = isHelpQuestion ? searchFaq(question) : [];
      const suggestionPool = isHelpQuestion ? [
        ...reply.related,
        ...matchingSections.flatMap(section => section.items),
        ...(matchingSections[0]?.category.items ?? []),
        ...FAQ_CATEGORIES.flatMap(category => category.items),
      ] : [];
      const seen = new Set<string>([question.toLowerCase()]);
      const related = suggestionPool.filter(item => {
        const key = item.question.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 8);
      setMessages(current => [...current, { id: nextId.current++, role: "assistant", content: reply.answer, related }]);
      setThinking(false);
    }, 350);
    setDraft("");
  }

  function submitDraft(event?: React.FormEvent) {
    event?.preventDefault();
    send(draft);
  }

  const latestSuggestions = activeChat
    ? [...messages].reverse().find(message => message.role === "assistant")?.related ?? []
    : [];
  const promptSuggestions = latestSuggestions.length
    ? latestSuggestions.map(item => ({ key: item.id, question: item.question }))
    : ASSISTANT_SUGGESTIONS.map((question, index) => ({ key: `suggestion-${index}`, question }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {activeChat && <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1 py-2.5" aria-live="polite">
        {messages.map(message => (
          <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[88%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[13px] leading-5", message.role === "user" ? "rounded-br-md bg-foreground text-background" : "rounded-bl-md bg-muted text-foreground")}>
              {message.content}
              {message.related && message.related.length > 0 && (
                <div className="mt-2.5 space-y-1.5 border-t border-border/60 pt-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Related questions</p>
                  {message.related.map(item => (
                    <button key={item.id} type="button" onClick={() => send(item.question)} className="block w-full whitespace-normal rounded-lg border border-border bg-background px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:text-foreground">
                      {item.question}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {thinking && <div className="text-xs text-muted-foreground">Searching the help center…</div>}
      </div>}
      <div ref={pickerRef} className="relative shrink-0 px-1 pb-1 pt-1">
        {suggestionsOpen && (
          <div className="absolute inset-x-1 bottom-[calc(100%+0.5rem)] z-20 max-h-[min(22rem,60vh)] overflow-y-auto rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl">
            <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Suggested questions</p>
            {promptSuggestions.map(item => (
              <button key={item.key} type="button" disabled={thinking} onClick={() => send(item.question)} className="block w-full rounded-lg px-2.5 py-2 text-left text-xs leading-5 text-foreground transition-colors hover:bg-accent disabled:opacity-50">
                {item.question}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={submitDraft} className="ksemo-composer-shell ksemo-help-composer-shell flex items-center gap-1.5 rounded-[20px] border border-border bg-popover p-1.5 text-popover-foreground shadow-sm transition-colors">
          <Input
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onFocus={() => setSuggestionsOpen(true)}
            placeholder={activeChat ? "Ask a KSEMO question…" : "Ask a question about KSEMO…"}
            aria-label="Ask a question about KSEMO"
            disabled={thinking}
            className="h-10 min-w-0 flex-1 rounded-none border-0 bg-transparent px-2.5 text-[15px] shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <Button
            type={draft.trim() ? "submit" : "button"}
            size="icon"
            onClick={draft.trim() ? undefined : () => setSuggestionsOpen(open => !open)}
            disabled={thinking}
            aria-label={draft.trim() ? "Send question" : "Show suggested questions"}
            aria-expanded={!draft.trim() ? suggestionsOpen : undefined}
            className="size-10 shrink-0 rounded-full bg-foreground text-background transition-colors hover:bg-foreground/90"
          >
            {draft.trim() ? <ArrowUp className="size-4" /> : <ChevronDown className={cn("size-4 transition-transform", suggestionsOpen && "rotate-180")} />}
          </Button>
        </form>
      </div>
    </div>
  );
}

const TOPIC_META: Record<
  SupportTopic,
  { title: string; label: string; icon: React.ReactNode }
> = {
  faq: {
    title: "Frequently asked questions",
    label: "Help center",
    icon: <HelpCircle className="size-3.5" />,
  },
  privacy: {
    title: "Privacy Policy",
    label: "Legal",
    icon: <ShieldCheck className="size-3.5" />,
  },
  terms: {
    title: "Terms of Service",
    label: "Legal",
    icon: <FileText className="size-3.5" />,
  },
};

function SupportShell({ topic }: { topic: SupportTopic }) {
  const meta = TOPIC_META[topic];
  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-5 sm:px-8">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-2 rounded-lg"
          >
            <a href="/">
              <ArrowLeft className="mr-1.5 size-4" />
              Back to KSEMO
            </a>
          </Button>
          <a
            href="/"
            className="flex items-center gap-2"
            aria-label="KSEMO home"
          >
            <img
              src="/KSEMOlogo.png"
              alt=""
              className="size-7 rounded-lg border border-border object-cover"
            />
            <span className="text-sm font-semibold tracking-tight">KSEMO</span>
          </a>
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl px-5 pb-14 pt-10 sm:px-8 sm:pt-14">
        <section className="text-center">
          <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 font-medium text-foreground/80">
              {meta.icon}
              {meta.label}
            </span>
            <span aria-hidden>·</span>
            <span>Last updated 17 October 2026</span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            {meta.title}
          </h1>
          {topic !== "faq" && (
            <p className="mx-auto mt-4 max-w-xl rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-xs leading-5 text-muted-foreground">
              These pages describe KSEMO's app-level practices. Hosting, AI
              providers, and local legal terms can vary by deployment.
            </p>
          )}
        </section>
        <div className="mt-10 gap-10 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)]">
          <SupportSectionNav topic={topic} />
          <div className="min-w-0">
            {topic === "faq" ? (
              <FaqContent />
            ) : topic === "privacy" ? (
              <PrivacyContent />
            ) : (
              <TermsContent />
            )}
          </div>
        </div>
        <footer className="mt-14 border-t border-border pt-6">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <img
                src="/KSEMOlogo.png"
                alt=""
                className="size-4 rounded border border-border object-cover"
              />
              © 2026 KSEMO
            </span>
            <span aria-hidden>·</span>
            <a
              href="/support/faq"
              className="transition-colors hover:text-foreground"
            >
              FAQ
            </a>
            <a
              href="/support/privacy"
              className="transition-colors hover:text-foreground"
            >
              Privacy Policy
            </a>
            <a
              href="/support/terms"
              className="transition-colors hover:text-foreground"
            >
              Terms of Service
            </a>
          </div>
        </footer>
        {topic === "faq" && <FaqAssistant />}
      </div>
    </main>
  );
}

function policySectionId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const PRIVACY_SECTION_TITLES = [
  "The short version",
  "Information we handle",
  "How KSEMO uses your information",
  "Memory and files",
  "Sharing and temporary chat",
  "Retention and your controls",
  "Security and providers",
  "Your choices and contact",
];

const TERMS_SECTION_TITLES = [
  "Using KSEMO",
  "Your account",
  "Your content",
  "AI responses",
  "Acceptable use",
  "Availability, limits, and changes",
  "Third-party services",
  "Disclaimers and liability",
  "Changes and contact",
];

// Tracks which section the reader is currently viewing. Position-based rather
// than observer-based: on every scroll frame the active section is simply the
// last heading above a line ~30% down the viewport, so detection stays exact
// for short and very long sections alike.
function useActiveSection(ids: Array<string>): string {
  const [activeId, setActiveId] = useState("");
  const idsKey = ids.join("|");
  useEffect(() => {
    if (typeof window === "undefined") return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const line = window.innerHeight * 0.3;
      let current = "";
      for (const id of idsKey.split("|")) {
        if (!id) continue;
        const element = document.getElementById(id);
        if (!element) continue;
        // Sections are ordered top-to-bottom, so the last heading that has
        // passed the line wins.
        if (element.getBoundingClientRect().top <= line) current = id;
        else break;
      }
      setActiveId(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [idsKey]);
  return activeId;
}

// The page's own outline beside the content: FAQ lists its categories with
// question counts; Privacy and Terms list their main headings. Rows echo the
// Settings navigation styling so all KSEMO surfaces feel alike.
function SupportSectionNav({ topic }: { topic: SupportTopic }) {
  const items = useMemo<Array<{ id: string; label: string }>>(
    function buildItems() {
      if (topic === "faq")
        return FAQ_CATEGORIES.map(category => ({
          id: `faq-${category.id}`,
          label: category.label,
        }));
      if (topic === "privacy")
        return PRIVACY_SECTION_TITLES.map(title => ({
          id: policySectionId(title),
          label: title,
        }));
      return TERMS_SECTION_TITLES.map(title => ({
        id: policySectionId(title),
        label: title,
      }));
    },
    [topic]
  );
  const activeId = useActiveSection(items.map(item => item.id));

  function scrollTo(id: string) {
    const element = document.getElementById(id);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
  }

  return (
    <nav
      aria-label={`${TOPIC_META[topic].title} sections`}
      className="mb-6 lg:sticky lg:top-20 lg:mb-0 lg:self-start"
    >
      <p className="hidden px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground lg:block">
        On this page
      </p>
      {/* Phones: swipeable pill row. Desktop: vertical outline. */}
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:block lg:space-y-0.5 lg:overflow-visible lg:px-0 lg:pb-0">
        {items.map(item => {
          const active = activeId === item.id;
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={event => {
                event.preventDefault();
                scrollTo(item.id);
              }}
              aria-current={active ? "true" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors",
                "lg:w-full lg:shrink lg:rounded-lg lg:border-transparent lg:px-3 lg:py-1.5 lg:text-[13px] lg:leading-5 lg:whitespace-normal",
                active
                  ? "border-border bg-muted font-medium text-foreground lg:bg-muted/70"
                  : "border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground lg:border-transparent lg:bg-transparent"
              )}
            >
              <span className="min-w-0">{item.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}

function FaqContent({ compact = false }: { compact?: boolean }) {
  const [query, setQuery] = useState("");
  // One open question per category. When a category has not been interacted
  // with yet its first question stays open; picking another question closes
  // the previously open one.
  const [openBySection, setOpenBySection] = useState<
    Record<string, string | null>
  >({});
  const sections = useMemo(() => searchFaq(query), [query]);

  function isOpen(sectionId: string, itemId: string, isFirst: boolean) {
    const selected = openBySection[sectionId];
    if (selected === undefined) return compact ? false : isFirst;
    return selected === itemId;
  }

  function toggleItem(sectionId: string, itemId: string) {
    setOpenBySection(current => {
      const next: Record<string, string | null> = { ...current };
      next[sectionId] = current[sectionId] === itemId ? null : itemId;
      return next;
    });
  }

  return (
    <div className={cn(compact ? "mt-3" : "mt-8")}>
      <div className={cn("relative", compact && "sticky top-0 z-10 bg-popover pb-2 pt-1")}>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder={compact ? "Search FAQs…" : "Search questions, answers, and topics…"}
          className={cn("rounded-xl pl-10 pr-9", compact ? "h-10 text-sm" : "h-11 text-[15px]")}
          aria-label="Search frequently asked questions"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      {!compact && (
        <p className="mt-3 text-xs text-muted-foreground" role="status">
          {query
            ? `Showing results for “${query.trim()}”`
            : "Click any question to see the answer"}
        </p>
      )}

      {sections.length ? (
        sections.map(section => (
          <section
            key={section.category.id}
            className={cn(compact ? "mt-5" : "mt-9")}
            aria-labelledby={`faq-${section.category.id}`}
          >
            <div className="flex items-baseline gap-2.5">
              <h2
                id={`faq-${section.category.id}`}
                className={cn("scroll-mt-20 font-semibold tracking-[-0.02em]", compact ? "px-1 text-base" : "text-lg")}
              >
                {section.category.label}
              </h2>
              {query && section.matchedCategory && (
                <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  topic match
                </span>
              )}
            </div>
            <div className={cn(compact ? "mx-1 mt-2 space-y-1.5" : "mt-3 space-y-2.5")}>
              {section.items.map((item, index) => {
                const expanded = isOpen(
                  section.category.id,
                  item.id,
                  index === 0
                );
                return (
                  <article
                    key={item.id}
                    className={cn("overflow-hidden border border-border bg-card", compact ? "rounded-xl" : "rounded-2xl")}
                  >
                    <button
                      onClick={() => toggleItem(section.category.id, item.id)}
                      className={cn("flex w-full items-center justify-between text-left", compact ? "gap-2.5 px-3 py-2.5" : "gap-4 px-5 py-4")}
                      aria-expanded={expanded}
                      aria-controls={`faq-answer-${item.id}`}
                    >
                      <span className={cn("font-medium leading-6", compact ? "text-[13px]" : "text-[15px]")}>
                        {item.question}
                      </span>
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                          expanded && "rotate-180"
                        )}
                        aria-hidden
                      />
                    </button>
                    {expanded && (
                      <div
                        id={`faq-answer-${item.id}`}
                        className={cn("border-t border-border", compact ? "px-3 py-3" : "px-5 py-4")}
                      >
                        <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
                          {item.answer}
                        </p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))
      ) : (
        <div className={cn("mt-10 grid place-items-center rounded-2xl border border-dashed border-border bg-muted/20 text-center", compact ? "min-h-32 p-5" : "min-h-40 p-8")}>
          <div>
            <Search className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">
              No questions match “{query.trim()}”
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a different word or clear your search to browse all questions.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 rounded-lg"
              onClick={() => setQuery("")}
            >
              Clear search
            </Button>
          </div>
        </div>
      )}
      {!compact && (
        <p className="pt-8 text-sm text-muted-foreground">
          Need more help? Reach us from Settings → Feedback.
        </p>
      )}
    </div>
  );
}

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  related?: FaqItem[];
};

function FaqAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      role: "assistant",
      content:
        "Hi! I am the KSEMO Assistant. Ask me anything about using KSEMO — files, sharing, privacy, and more.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextIdRef = useRef(1);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, thinking]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 150);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(timer);
    };
  }, [open]);

  function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || thinking) return;
    setMessages(current => [
      ...current,
      { id: nextIdRef.current++, role: "user", content: trimmed },
    ]);
    setDraft("");
    setThinking(true);
    window.setTimeout(() => {
      const reply = answerFromFaq(trimmed);
      setMessages(current => [
        ...current,
        {
          id: nextIdRef.current++,
          role: "assistant",
          content: reply.answer,
          related: reply.related,
        },
      ]);
      setThinking(false);
    }, 500);
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setOpen(current => !current)}
            className="fixed bottom-6 right-6 z-50 flex size-[3.25rem] items-center justify-center rounded-full border border-border bg-foreground text-background shadow-lg transition-transform duration-150 hover:scale-105 active:scale-95"
            aria-label={open ? "Close KSEMO Assistant" : "Open KSEMO Assistant"}
            aria-expanded={open}
          >
            {open ? (
              <X className="size-5" />
            ) : (
              <Bot className="size-[1.35rem]" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">Ask the KSEMO Assistant</TooltipContent>
      </Tooltip>

      {open && (
        <div
          className="fixed bottom-24 right-4 z-50 flex h-[min(30rem,calc(100dvh-8.5rem))] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200 sm:right-6"
          role="dialog"
          aria-label="KSEMO Assistant chat"
        >
          <header className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-3">
            <img
              src="/KSEMOlogo.png"
              alt=""
              className="size-7 rounded-lg border border-border object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">KSEMO Assistant</p>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span
                  className="size-1.5 rounded-full bg-foreground/70"
                  aria-hidden
                />
                Answers from the help center
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-0 focus-visible:border-transparent"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
            >
              <X className="size-3.5" />
            </Button>
          </header>

          <div
            ref={listRef}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3.5 py-4"
            aria-live="polite"
          >
            {messages.map(message => (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-5 whitespace-pre-line",
                    message.role === "user"
                      ? "rounded-br-md bg-foreground text-background"
                      : "rounded-bl-md bg-muted text-foreground"
                  )}
                >
                  {message.content}
                  {message.related && message.related.length > 0 && (
                    <div className="mt-2.5 space-y-1.5 border-t border-border/60 pt-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                        Related questions
                      </p>
                      {message.related.map(item => (
                        <button
                          key={item.id}
                          onClick={() => ask(item.question)}
                          className="block w-full truncate rounded-lg border border-border bg-background px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {item.question}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-start" role="status">
                <ThinkingIndicator />
              </div>
            )}
            {messages.length <= 1 && !thinking && (
              <div className="space-y-1.5 pt-1">
                <p className="flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  <Sparkles className="size-3" />
                  Try asking
                </p>
                {ASSISTANT_SUGGESTIONS.map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => ask(suggestion)}
                    className="block w-full truncate rounded-xl border border-border bg-background px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            className="flex shrink-0 items-center gap-2 border-t border-border p-3"
            onSubmit={event => {
              event.preventDefault();
              ask(draft);
            }}
          >
            <Input
              ref={inputRef}
              value={draft}
              onChange={event => setDraft(event.target.value)}
              placeholder="Ask about KSEMO…"
              className="h-9 rounded-xl bg-background text-[13px]"
              aria-label="Ask the KSEMO Assistant"
              maxLength={300}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!draft.trim() || thinking}
              className="size-9 shrink-0 rounded-xl bg-foreground text-background hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground"
              aria-label="Send question"
            >
              {thinking ? (
                <Send className="size-4" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </Button>
          </form>
        </div>
      )}
    </>
  );
}

function PolicySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={policySectionId(title)} className="scroll-mt-20">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="mt-2.5 space-y-3 text-sm leading-7 text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function PolicyBullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2.5">
          <span
            className="mt-[0.65em] size-1 shrink-0 rounded-full bg-muted-foreground/70"
            aria-hidden
          />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function PrivacyContent() {
  return (
    <div className="mt-9 space-y-8 text-sm leading-7 text-muted-foreground">
      <PolicySection title="The short version">
        <p>
          KSEMO stores the information needed to run your account and the
          features you use. Your chats and files are private to your account
          unless you create a public share link or choose a provider feature
          such as cloud import. We do not sell your personal information.
        </p>
      </PolicySection>
      <PolicySection title="Information we handle">
        <PolicyBullets items={[
          <>Account details used to sign in, such as your name, email, and account identifier.</>,
          <>Chats, attachments, saved memories, and preferences you choose to keep in KSEMO.</>,
          <>Technical and session information needed to provide, protect, and troubleshoot the service. Hosting and provider logs depend on the deployment.</>,
        ]} />
      </PolicySection>
      <PolicySection title="How KSEMO uses your information">
        <p>
          We use your information to provide chat, voice, file analysis,
          document creation, search, memory, sharing, account, and support
          features. When you send a request, KSEMO sends the relevant message
          context and any selected files or memories to the AI provider
          configured for the service. Provider retention and model-improvement
          practices are governed by that provider's terms and configuration.
        </p>
      </PolicySection>
      <PolicySection title="Memory and files">
        <p>
          Check the Memory setting in your account. When enabled, KSEMO may
          extract facts from chats and use saved memories in later responses.
          Turning Memory off stops new extraction and use; remove saved memories
          separately in Settings → Memory.
        </p>
        <p>
          Library files stay associated with your account and are processed when
          you choose them for a feature. Connecting Google Drive or OneDrive
          lets you select files to copy into KSEMO; disconnecting removes the
          saved connection grant.
        </p>
      </PolicySection>
      <PolicySection title="Sharing and temporary chat">
        <p>
          A public conversation link can be opened by anyone who has it. Turn
          sharing off to disable the link, but recipients may already have
          copied its contents. Temporary chat is excluded from saved history
          and Memory, but messages are processed and temporarily stored to run
          the session. The app attempts to delete them when the session ends;
          this is not a zero-retention promise for providers or backups.
        </p>
      </PolicySection>
      <PolicySection title="Retention and your controls">
        <p>
          Chats and files remain until you delete them or delete your account.
          You can review and remove memories, delete chats and files, disable
          sharing, and delete your account in Settings. Deletion removes data
          from active application records; backup and provider retention depend
          on the service deployment and applicable law.
        </p>
      </PolicySection>
      <PolicySection title="Security and providers">
        <p>
          KSEMO uses account-based access controls. Encryption, operational
          logging, provider access, and retention can depend on how the service
          is deployed. Information may be processed by providers for sign-in,
          hosting, storage, AI responses, cloud imports, and email support. See
          the notices for the KSEMO instance you use and each provider's terms.
        </p>
      </PolicySection>
      <PolicySection title="Your choices and contact">
        <p>
          You can manage content and account settings in the app. For privacy
          questions or a request you cannot complete there, use Settings →
          Feedback. Your legal rights depend on your location and the service
          operator. This policy does not replace notices required by local law.
        </p>
      </PolicySection>
    </div>
  );
}

function TermsContent() {
  return (
    <div className="mt-9 space-y-8 text-sm leading-7 text-muted-foreground">
      <PolicySection title="Using KSEMO">
        <p>
          These terms apply when you use KSEMO chat, voice, files, Memory,
          document creation, sharing, and related features. Use the service only
          if you may legally agree to these terms in your location. The service
          owner may need to set a higher minimum age where local law requires it.
        </p>
      </PolicySection>
      <PolicySection title="Your account">
        <p>
          Keep your sign-in details secure and use your own account. You are
          responsible for activity under your account. Contact support through
          Settings → Feedback if you suspect unauthorized access.
        </p>
      </PolicySection>
      <PolicySection title="Your content">
        <p>
          You keep ownership of the content you submit. You allow KSEMO to host,
          process, and display it as needed to provide the features you use,
          including sending relevant content to the configured AI provider when
          you request a response. Delete your content or account to end this
          permission, subject to provider, backup, and legal retention.
        </p>
        <p>
          You are responsible for having the rights to upload, use, and share
          your content. Public links can be read by anyone who has the link.
        </p>
      </PolicySection>
      <PolicySection title="AI responses">
        <p>
          AI responses can be incorrect, incomplete, or outdated. Review them
          before relying on them, especially for medical, legal, financial, or
          other important decisions. KSEMO does not provide professional advice
          or guarantee a particular result.
        </p>
      </PolicySection>
      <PolicySection title="Acceptable use">
        <p>
          Do not use KSEMO unlawfully, infringe others' rights, harm or exploit
          children, distribute malware, interfere with the service, bypass
          security or usage controls, or attempt unauthorized access. We may
          restrict access when needed to protect users, the service, or comply
          with law.
        </p>
      </PolicySection>
      <PolicySection title="Availability, limits, and changes">
        <p>
          Features, model availability, and usage limits may change or be
          unavailable. Pricing and payment terms, if any, are those shown by the
          operator for the KSEMO instance you use. We may suspend or end access
          for misuse, security reasons, or legal requirements.
        </p>
      </PolicySection>
      <PolicySection title="Third-party services">
        <p>
          KSEMO may connect to third-party services such as Google, Microsoft,
          hosting, email, and AI providers. Their own terms and privacy notices
          apply to your use of those services and to their processing of
          information.
        </p>
      </PolicySection>
      <PolicySection title="Disclaimers and liability">
        <p>
          KSEMO is provided as available. To the extent permitted by law, the
          service owner is not responsible for indirect or consequential loss
          arising from use of the service. Nothing in these terms limits
          liability or consumer rights that cannot lawfully be limited.
        </p>
      </PolicySection>
      <PolicySection title="Changes and contact">
        <p>
          We may update these terms as the service changes and will update the
          date above. Questions or concerns can be sent through Settings →
          Feedback. The legal entity and governing law are those disclosed by
          the operator for your KSEMO instance. Mandatory local consumer rights
          continue to apply.
        </p>
      </PolicySection>
    </div>
  );
}

export function FaqPage() {
  return <SupportShell topic="faq" />;
}
export function PrivacyPage() {
  return <SupportShell topic="privacy" />;
}
export function TermsPage() {
  return <SupportShell topic="terms" />;
}
