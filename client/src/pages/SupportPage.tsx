import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
            <span>Last updated 21 August 2026</span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            {meta.title}
          </h1>
          {topic !== "faq" && (
            <p className="mx-auto mt-4 max-w-xl rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-xs leading-5 text-muted-foreground">
              Draft for KSEMO product transparency. This information should be
              reviewed by qualified counsel before relying on it as a final
              legal policy.
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
  "Overview",
  "What KSEMO stores",
  "How your information is used",
  "Conversations and message history",
  "Files and Library storage",
  "Sharing and public links",
  "Authentication and account security",
  "Cookies and local storage",
  "Service providers",
  "Data retention and deletion",
  "Your choices and controls",
  "Your privacy rights",
  "Security measures",
  "Children's privacy",
  "International transfers",
  "Changes to this policy",
  "Contact",
];

const TERMS_SECTION_TITLES = [
  "Acceptance of terms",
  "Definitions",
  "Eligibility",
  "Using KSEMO",
  "Account responsibilities",
  "Acceptable use",
  "AI output",
  "Your content",
  "Files and Library",
  "Sharing links",
  "Fees, usage limits, and plans",
  "Intellectual property",
  "Third-party services",
  "Availability and changes",
  "Termination",
  "Disclaimers",
  "Limitation of liability",
  "Indemnification",
  "Governing law and disputes",
  "Changes to these terms",
  "General provisions",
  "Questions",
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

function FaqContent() {
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
    if (selected === undefined) return isFirst;
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
    <div className="mt-8">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search questions, answers, and topics…"
          className="h-11 rounded-xl pl-10 pr-9 text-[15px]"
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
      <p className="mt-3 text-xs text-muted-foreground" role="status">
        {query
          ? `Showing results for “${query.trim()}”`
          : "Click any question to see the answer"}
      </p>

      {sections.length ? (
        sections.map(section => (
          <section
            key={section.category.id}
            className="mt-9"
            aria-labelledby={`faq-${section.category.id}`}
          >
            <div className="flex items-baseline gap-2.5">
              <h2
                id={`faq-${section.category.id}`}
                className="scroll-mt-20 text-lg font-semibold tracking-[-0.02em]"
              >
                {section.category.label}
              </h2>
              {query && section.matchedCategory && (
                <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  topic match
                </span>
              )}
            </div>
            <div className="mt-3 space-y-2.5">
              {section.items.map((item, index) => {
                const expanded = isOpen(
                  section.category.id,
                  item.id,
                  index === 0
                );
                return (
                  <article
                    key={item.id}
                    className="overflow-hidden rounded-2xl border border-border bg-card"
                  >
                    <button
                      onClick={() => toggleItem(section.category.id, item.id)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                      aria-expanded={expanded}
                      aria-controls={`faq-answer-${item.id}`}
                    >
                      <span className="text-[15px] font-medium leading-6">
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
                        className="border-t border-border px-5 py-4"
                      >
                        <p className="text-sm leading-6 text-muted-foreground">
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
        <div className="mt-10 grid min-h-40 place-items-center rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
          <div>
            <Search className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">
              No questions match “{query.trim()}”
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a different word, or ask the KSEMO Assistant in the corner.
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
      <p className="pt-8 text-sm text-muted-foreground">
        Need more help? Ask the KSEMO Assistant at the bottom-right, or reach us
        from Settings → Feedback.
      </p>
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
              <div className="flex justify-start">
                <div
                  className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-muted px-3.5 py-3"
                  aria-label="Assistant is typing"
                >
                  {[0, 1, 2].map(dot => (
                    <span
                      key={dot}
                      className="size-1.5 animate-pulse rounded-full bg-muted-foreground"
                      style={{ animationDelay: `${dot * 160}ms` }}
                    />
                  ))}
                </div>
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
    <div className="mt-9 space-y-9 text-sm leading-7 text-muted-foreground">
      <PolicySection title="Overview">
        <p>
          This Privacy Policy explains, in plain language, what information
          KSEMO collects when you create an account or use the service, why that
          information is needed, how it is protected, and the choices and rights
          available to you. It covers the KSEMO web application and every
          feature inside it: chat conversations, the Library,
          sharing links, exports, and account settings.
        </p>
        <p>
          KSEMO is designed around a simple model. Your workspace is private to
          your account. Nothing is remembered about you unless you deliberately
          save it. And deletion
          tools are direct and permanent rather than hidden behind support
          requests.
        </p>
        <p>
          When we say “we”, “us”, or “KSEMO”, we mean the operators of the KSEMO
          service. When we say “you”, we mean any registered user of the
          service. We act as the controller of your account information; the
          independent companies we rely on for authentication, hosting, and AI
          processing act on our instructions under their own terms.
        </p>
      </PolicySection>
      <PolicySection title="What KSEMO stores">
        <p>
          The service stores only what it needs to function for you, organized
          by feature:
        </p>
        <PolicyBullets
          items={[
            <>
              Account identity from Google sign-in: your name, email address,
              and account identifier. KSEMO never sees or stores your Google
              password.
            </>,
            <>
              Conversations: every chat title, message text, timestamps, model
              metadata, and the state needed to show your history — including
              archive, trash, and sharing status.
            </>,
            <>
              Message versions: when you edit a user message or restore a
              version, prior text is retained as version history so you can
              compare outcomes.
            </>,
            <>
              Voice transcripts: spoken turns are transcribed to text and saved
              as normal conversation messages, subject to the same controls as
              typed text.
            </>,
            <>
              Library files: documents and images you upload, stored as file
              bytes in private object storage linked to your account.
            </>,
            <>
              Preferences: selected model, response style, custom instructions,
              speech rate, autoplay, reduce-motion, and similar accessibility
              settings.
            </>,
            <>
              Operational records: sign-in session cookies, feedback messages
              you send us, and minimal diagnostics required to run and secure
              the service.
            </>,
          ]}
        />
        <p>
          KSEMO does not collect advertising identifiers, precise location,
          contacts, browsing history from other sites, or sensitive categories
          of information unless you choose to place them in your own content.
        </p>
      </PolicySection>
      <PolicySection title="How your information is used">
        <PolicyBullets
          items={[
            <>
              To generate responses: your messages and attached files
              are sent to the configured server-side AI service to
              produce answers.
            </>,
            <>
              To maintain history: storing conversations lets you reopen,
              search, rename, duplicate, share, export, and delete them at any
              time.
            </>,
            <>
              To personalize replies: saved preferences
              shape tone, detail, and continuity across chats.
            </>,
            <>
              To keep the service safe: authentication data protects your
              session; operational monitoring helps detect abuse and faults.
            </>,
            <>
              To communicate with you: responding to feedback you submit and,
              where necessary, notifying you about material service changes.
            </>,
          ]}
        />
        <p>
          Where privacy law requires a legal basis, processing rests on
          performing our contract with you (operating the features you use),
          legitimate interests (security, abuse prevention), consent (public
          sharing), or legal obligation.
        </p>
        <p>
          We do not sell your personal information, and we do not share it with
          advertising networks or data brokers. Your content is not used to
          train third-party foundation models beyond the transient processing
          needed to answer your requests.
        </p>
      </PolicySection>
      <PolicySection title="Conversations and message history">
        <p>
          Conversations persist until you delete them, so your history survives
          refreshes, new devices, and new sessions. Persistence is what makes
          rename, search, duplication, export, and sharing possible; it is
          always under your control.
        </p>
        <PolicyBullets
          items={[
            <>
              Archiving hides a conversation from your sidebar without deleting
              it. Trashed conversations remain recoverable until you permanently
              delete them or empty the trash.
            </>,
            <>
              Deleting a conversation permanently removes its messages and
              versions. Deleting a single message removes that message and its
              version history.
            </>,
            <>
              “Delete all chats” permanently removes every conversation in your
              account in one confirmed action.
            </>,
            <>
              Duplicating a conversation creates an independent copy under your
              account; deleting the original does not affect the copy.
            </>,
            <>
              Exports (PDF or Word) are generated from your stored messages on
              request and downloaded directly by you.
            </>,
          ]}
        />
        <p>
          If a conversation was shared while active and is then deleted, the
          public link stops resolving. Deleting content is not reversible, which
          is why destructive actions ask for confirmation first.
        </p>
      </PolicySection>
      <PolicySection title="Files and Library storage">
        <p>
          Files you add to the Library are private to your account. They are
          stored outside the chat database in secured object storage and are
          reached only through short-lived, authorized links generated for your
          session.
        </p>
        <PolicyBullets
          items={[
            <>
              A file is included with an AI request only when you explicitly
              attach or select it for that conversation.
            </>,
            <>
              Removing a Library file revokes its availability, including within
              messages that previously referenced it.
            </>,
            <>
              Uploads are limited in size and type; these limits protect both
              you and the service.
            </>,
            <>
              Files are not scanned or analyzed beyond the processing you
              request for them.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Sharing and public links">
        <p>
          Sharing is opt-in per conversation. When you enable a public link,
          that specific conversation becomes viewable by anyone who has the link
          — no KSEMO account is needed to read it.
        </p>
        <PolicyBullets
          items={[
            <>
              Shared views are read-only: visitors cannot send messages, see
              your other conversations, or access your Library.
            </>,
            <>
              Disabling public sharing invalidates the existing link
              immediately; deleting the conversation does the same.
            </>,
            <>
              Visitors are not shown advertising and we do not build visitor
              profiles from shared-link reads.
            </>,
            <>
              Treat shared links like printed pages: remove sensitive details
              before enabling a public link, because recipients may copy or
              redistribute what they see.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Authentication and account security">
        <PolicyBullets
          items={[
            <>
              Sign-in uses Google's OAuth flow. KSEMO never sees or stores your
              Google password, and cannot act on your Google account beyond the
              identity information you approve.
            </>,
            <>
              Session integrity relies on secure, signed cookies scoped to the
              KSEMO application.
            </>,
            <>
              Signing out ends the browser session; your data remains safely
              associated with your account for next time.
            </>,
            <>
              If you believe someone used your session without permission, sign
              out, secure your Google account, then contact us so we can
              investigate.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Cookies and local storage">
        <p>
          KSEMO uses browser storage sparingly and never for cross-site
          tracking.
        </p>
        <PolicyBullets
          items={[
            <>
              A strictly necessary session cookie keeps you signed in. It is
              scoped to the KSEMO application and cleared when you sign out.
            </>,
            <>
              Interface preferences (for example selected model or motion
              settings) may be stored in your browser's local storage so the app
              remembers them between visits.
            </>,
            <>
              No advertising cookies, third-party analytics trackers, or
              fingerprinting scripts run inside KSEMO today.
            </>,
            <>
              Clearing site data in your browser will sign you out and reset
              preferences; it does not delete server-side content such as
              conversations or files.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Service providers">
        <p>KSEMO relies on a small set of independent providers to operate:</p>
        <PolicyBullets
          items={[
            <>Google: account authentication and identity verification.</>,
            <>
              Server-side AI services: processing prompts, attachments, and
              transcripts to generate responses.
            </>,
            <>
              Cloud hosting and storage providers: serving the application and
              storing Library files and account data.
            </>,
            <>
              Email delivery: sending messages you initiate, such as feedback
              submissions.
            </>,
          ]}
        />
        <p>
          Providers receive only what is necessary for their function, under
          terms that require confidentiality and appropriate security. They are
          not permitted to sell your data or reuse it for their own marketing.
          This list may be updated as the service evolves, and this policy will
          reflect material changes.
        </p>
      </PolicySection>
      <PolicySection title="Data retention and deletion">
        <p>
          You control retention. Conversations and files persist only
          while you keep them, and every category has a direct deletion control
          in the product.
        </p>
        <PolicyBullets
          items={[
            <>
              Permanent deletion removes content from the active system
              promptly; residual encrypted backups expire on the backup rotation
              schedule before disappearing entirely.
            </>,
            <>
              Trashed items remain recoverable until permanently deleted;
              archived items are retained normally but hidden from the main
              list.
            </>,
            <>
              Abandoned or suspended accounts may be purged after a prolonged
              inactive period where legally permitted, with notice where
              feasible.
            </>,
            <>
              We retain the minimum operational records required for security
              and compliance, for as long as necessary.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Your choices and controls">
        <PolicyBullets
          items={[
            <>
              Access: reopen any conversation at any time, on any device where
              you sign in.
            </>,
            <>
              Export: download conversations as PDF or Word whenever you want a
              copy outside KSEMO.
            </>,
            <>
              Correct: edit your own messages; earlier versions remain recorded
              for transparency.
            </>,
            <>
              Delete: remove individual messages, entire conversations, all
              chats at once, and Library files — permanently.
            </>,
            <>
              Restrict: turn off autoplay speech, and avoid
              attaching files you prefer not to use.
            </>,
            <>
              Withdraw sharing: switch off any public link whenever you choose.
            </>,
          ]}
        />
        <p>
          If a control you need is missing, tell us through the contact paths
          below — requests that cannot be satisfied in-product are handled
          manually wherever feasible.
        </p>
      </PolicySection>
      <PolicySection title="Your privacy rights">
        <p>
          Depending on where you live, privacy laws such as the EU/EEA General
          Data Protection Regulation, the UK GDPR, the California Consumer
          Privacy Act as amended, and similar legislation may grant you formal
          rights over your information, including the right to access, correct,
          delete, restrict or object to processing, port your data, withdraw
          consent, and be free from discrimination for exercising these rights.
        </p>
        <p>
          KSEMO's built-in tools satisfy most of these rights directly: you can
          view, export, correct, and delete your content without asking us. For
          anything else, use the contact paths below and describe the right you
          wish to exercise. We will verify your identity as needed and respond
          within the window required by the applicable law.
        </p>
        <p>
          You also have the right to lodge a complaint with your local
          supervisory authority if you believe our processing violates
          applicable law.
        </p>
      </PolicySection>
      <PolicySection title="Security measures">
        <PolicyBullets
          items={[
            <>
              Encrypted transport (HTTPS/TLS) for traffic between your browser
              and KSEMO services.
            </>,
            <>
              Private storage with encryption at rest provided by our cloud
              infrastructure, and access limited to authenticated features you
              explicitly use.
            </>,
            <>
              Least-privilege internal access rules and monitoring of the
              service for abuse, faults, and suspicious activity.
            </>,
            <>
              A commitment to notify affected users — and regulators where
              required — promptly in the event of a qualifying data incident.
            </>,
          ]}
        />
        <p>
          No method of transmission or storage is perfectly secure, so we also
          encourage strong Google account security and two-step verification;
          protecting your Google account protects KSEMO too.
        </p>
      </PolicySection>
      <PolicySection title="Children's privacy">
        <p>
          KSEMO is intended for users who meet the minimum digital-consent age
          in their jurisdiction. We do not knowingly create accounts for
          children below that age, and we do not knowingly collect their
          personal information.
        </p>
        <p>
          If you are a parent or guardian and believe a child has created an
          account, contact us through the channels below; we will remove the
          account and its associated data.
        </p>
      </PolicySection>
      <PolicySection title="International transfers">
        <p>
          Your information may be processed in countries other than your own,
          including by our authentication, hosting, storage, and AI providers.
          Laws in those countries may differ from those of your home
          jurisdiction.
        </p>
        <p>
          Where transfers of personal data are subject to cross-border transfer
          restrictions, we rely on appropriate safeguards such as standard
          contractual clauses or equivalent mechanisms recognized under
          applicable law.
        </p>
      </PolicySection>
      <PolicySection title="Changes to this policy">
        <p>
          We may update this policy as KSEMO evolves — for example when features
          change what is stored or how providers are used. Material changes will
          be announced in the product or on this page with a revised “Last
          updated” date before they take effect.
        </p>
        <p>
          Continued use after changes take effect means you accept the updated
          policy. If a change materially reduces protections for content you
          have already stored, we will provide prominent notice and, where
          feasible, choice before it applies to that content.
        </p>
      </PolicySection>
      <PolicySection title="Contact">
        <p>
          For privacy questions, data-access requests, or account help, use the
          Help &amp; Support link available from your KSEMO profile menu, or
          reach us through Settings → Feedback. Describe your request clearly
          and include the email address on your account so we can verify and
          assist quickly.
        </p>
      </PolicySection>
    </div>
  );
}

function TermsContent() {
  return (
    <div className="mt-9 space-y-9 text-sm leading-7 text-muted-foreground">
      <PolicySection title="Acceptance of terms">
        <p>
          By creating an account or using KSEMO you agree to these Terms of
          Service, which form a binding agreement between you and the operators
          of KSEMO. If you do not agree, please do not use the service.
        </p>
        <p>
          These terms apply to every feature: chat, the Library,
          sharing links, exports, and account settings. Product notices or
          guidelines presented inside the app supplement these terms. If you use
          KSEMO on behalf of an organization, you represent that you have
          authority to bind that organization to this agreement.
        </p>
      </PolicySection>
      <PolicySection title="Definitions">
        <PolicyBullets
          items={[
            <>
              “Service” means the KSEMO web application and all related
              functionality operated by us.
            </>,
            <>
              “Content” means what you submit or upload: messages, Library
              files, and preferences.
            </>,
            <>
              “Output” means AI-generated responses produced by the Service from
              your prompts and Content.
            </>,
            <>
              “Conversation” means a saved thread of messages under your
              account; “Library” means your uploaded files.
            </>,
            <>
              “Providers” means the independent third parties that host,
              authenticate, store, or process on our behalf.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Eligibility">
        <p>
          You must meet the minimum digital-consent age in your jurisdiction to
          use KSEMO, and you must not be barred from using the service under
          applicable law, including sanctions and export-control restrictions.
        </p>
        <p>
          Accounts are created through Google sign-in, so Google's own terms
          also govern that relationship. One person uses one account; sharing a
          single account among several people is not supported and is done at
          your own risk.
        </p>
      </PolicySection>
      <PolicySection title="Using KSEMO">
        <PolicyBullets
          items={[
            <>
              KSEMO is an AI assistant for conversation and file analysis.
            </>,
            <>
              Use the service in compliance with applicable laws and only
              through the official interfaces provided; scraping, undocumented
              APIs, and automated bulk access are not permitted.
            </>,
            <>
              Features may evolve: we may add, change, or retire functionality
              as the product improves, with reasonable efforts to give notice
              for material removals.
            </>,
            <>
              Early-access or experimental features may be less reliable and may
              change or disappear without notice.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Account responsibilities">
        <PolicyBullets
          items={[
            <>
              Keep your Google account secure; you are responsible for all
              activity that occurs under your session.
            </>,
            <>
              Do not use KSEMO on shared devices you do not trust, and sign out
              when finished on any shared computer.
            </>,
            <>
              Accounts are personal. Do not resell access, redistribute the
              service, or operate it for third parties as a service bureau.
            </>,
            <>
              Do not impersonate another person or misrepresent affiliation with
              any entity through your account, content, or shared links.
            </>,
            <>
              Tell us promptly if you suspect unauthorized use of your account
              or session.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Acceptable use">
        <p>
          KSEMO should be safe for you and everyone else. Accordingly, you agree
          not to use the service to create, store, or distribute:
        </p>
        <PolicyBullets
          items={[
            <>
              unlawful, fraudulent, deceptive, defamatory, or harassing
              material;
            </>,
            <>
              content that exploits or harms minors, or that promotes violence,
              self-harm, or illegal activity;
            </>,
            <>
              material that infringes intellectual-property, privacy, or other
              rights of any third party;
            </>,
            <>
              malware, or code intended to disrupt, overload, or gain
              unauthorized access to any system.
            </>,
          ]}
        />
        <PolicyBullets
          items={[
            <>
              Do not attempt to reverse-engineer the service, circumvent usage
              limits or security controls, probe vulnerabilities without
              authorization, or interfere with other users.
            </>,
            <>
              Do not submit third-party personal data unless you have a lawful
              basis and, where required, their consent.
            </>,
            <>
              Do not use Output to mislead people — for example fake reviews,
              fabricated citations, or impersonation of real individuals.
            </>,
            <>
              Violations may result in suspension or termination, and we may
              cooperate with lawful requests from authorities where required.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="AI output">
        <p>
          Responses generated by AI models are probabilistic: they can be
          incomplete, outdated, or simply wrong. Treat Output as a starting
          point and verify anything consequential before relying on it.
        </p>
        <PolicyBullets
          items={[
            <>
              Before legal, medical, financial, safety-related, or similarly
              consequential decisions, consult a qualified professional.
            </>,
            <>
              Generated content is not professional advice and does not create a
              professional relationship with KSEMO or its operators.
            </>,
            <>
              In an emergency, contact your local emergency services rather than
              an AI assistant.
            </>,
            <>
              Regenerated or edited responses may differ; message version
              history exists precisely so you can compare outcomes.
            </>,
            <>
              Output may resemble existing third-party material; confirm your
              rights before republishing it commercially.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Your content">
        <p>
          You retain ownership of everything you submit: messages and files. These terms do not take that away.
        </p>
        <p>
          You grant KSEMO a limited license to store, reproduce, process,
          display, and transmit your Content solely as needed to operate the
          features you use — including technical adaptations such as format
          conversion for transcription, attachment handling, or document
          exports. This license ends when your content is deleted, except for
          backups on their rotation schedule and records we must keep by law.
        </p>
        <p>
          You are responsible for having the rights to what you upload, for the
          share links you create, and for keeping your own copies of
          irreplaceable material — exports exist for exactly this purpose. If
          you send us product suggestions, you agree we may use them without
          obligation or attribution.
        </p>
      </PolicySection>
      <PolicySection title="Files and Library">
        <p>
          The Library exists for documents and images you want available
          alongside your conversations. Upload only content you have the rights
          to store and process.
        </p>
        <PolicyBullets
          items={[
            <>
              Size and type limits apply; attempting to circumvent them is not
              permitted.
            </>,
            <>
              Attaching a file authorizes processing of that file for the
              relevant request; it is never shared with other users' requests.
            </>,
            <>
              Do not upload malicious files or material designed to disrupt the
              service or other users.
            </>,
            <>
              Removing a Library file revokes its availability, including in
              messages that previously referenced it.
            </>,
          ]}
        />
      </PolicySection>

      <PolicySection title="Sharing links">
        <PolicyBullets
          items={[
            <>
              Public links make the chosen conversation readable by anyone who
              has the link, without needing an account. You choose what to share
              and are responsible for that choice.
            </>,
            <>
              Shared views are read-only; visitors cannot message, edit, or see
              anything else in your workspace.
            </>,
            <>
              You may disable any link at any time, which immediately
              invalidates it; deleting the conversation has the same effect.
            </>,
            <>
              Once public, content may be copied, cached, or indexed by others;
              we cannot recall third-party copies.
            </>,
            <>
              Do not publish links whose disclosure would violate law,
              confidentiality obligations, or others' rights.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Fees, usage limits, and plans">
        <p>
          KSEMO is currently offered free of charge during its launch period. To
          keep capacity fair for everyone, fair-use limits apply per model and
          reset on a rolling daily cycle; switching models gives you a separate
          allowance. Limits exist to protect service quality and prevent abuse,
          and may be adjusted as capacity evolves.
        </p>
        <p>
          If paid plans are introduced in the future, the price, billing cycle,
          and what is included will be disclosed clearly before you subscribe.
          Price changes would be announced in advance, recurring plans would be
          cancelable before renewal, applicable taxes would be shown at
          checkout, and refunds would follow the terms stated for the specific
          plan. If you ever believe a charge is wrong, contact us through
          Settings → Feedback before initiating a payment dispute so we can
          resolve it quickly.
        </p>
        <p>
          Free usage does not create an entitlement to any particular level of
          availability, and nothing in this section obligates us to introduce
          paid tiers.
        </p>
      </PolicySection>
      <PolicySection title="Intellectual property">
        <p>
          The KSEMO name, interface, software, and design are protected by
          intellectual-property laws. Except where licensed otherwise, you may
          not copy, modify, or redistribute the service itself.
        </p>
        <p>
          Your Content remains yours. As between you and KSEMO, and to the
          extent permitted by law, you may use the Output generated from your
          prompts, subject to these terms and to any rights third parties may
          hold in underlying material.
        </p>
        <p>
          If you believe content accessible through KSEMO infringes your rights,
          notify us via Settings → Feedback with enough detail to identify the
          material; we will investigate and remove infringing content where a
          claim is valid, and may suspend repeat infringers' accounts.
        </p>
      </PolicySection>
      <PolicySection title="Third-party services">
        <p>
          KSEMO depends on independent providers — Google for sign-in, AI
          services for generating responses, cloud infrastructure for hosting
          and storage. Their own terms and privacy policies govern their
          portions of the pipeline, and their availability can occasionally
          affect features.
        </p>
        <p>
          Content reached through shared links or external references is not
          endorsed by us, and we are not responsible for third-party sites or
          services you connect to from within KSEMO.
        </p>
      </PolicySection>
      <PolicySection title="Availability and changes">
        <PolicyBullets
          items={[
            <>
              We aim for high availability but do not guarantee uninterrupted or
              error-free operation.
            </>,
            <>
              Maintenance, outages, provider issues, or force-majeure events can
              temporarily affect features.
            </>,
            <>
              We may add, change, or retire functionality; where a feature
              removal materially affects stored workflows, we will make
              reasonable efforts to give advance notice.
            </>,
            <>
              We may limit, throttle, or suspend access when needed to protect
              users, maintain the service, or comply with applicable
              requirements.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Termination">
        <p>
          You may stop using KSEMO at any time. Before leaving, delete the
          content you do not want to remain — or ask us to close your account
          and remove its data through the contact paths below.
        </p>
        <PolicyBullets
          items={[
            <>
              We may suspend or terminate accounts that violate these terms,
              create risk for the service or others, or where required by law.
            </>,
            <>
              On termination, access ends and public sharing links are
              invalidated.
            </>,
            <>
              Provisions that should survive termination — ownership, content
              licenses already granted, disclaimers, liability limits,
              indemnification, and dispute terms — do so.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Disclaimers">
        <p>
          KSEMO is provided “as is” and “as available”, without warranties of
          any kind, whether express or implied, including warranties of
          merchantability, fitness for a particular purpose, non-infringement,
          accuracy, and uninterrupted operation, to the maximum extent permitted
          by law.
        </p>
        <p>
          We do not warrant that Output will be accurate, complete, or suitable
          for your purposes, that files stored in the Library will be free of
          loss without your own backups, or that downloaded exports will be free
          of defects. Some jurisdictions do not allow certain warranty
          exclusions, so parts of this section may not apply to you.
        </p>
      </PolicySection>
      <PolicySection title="Limitation of liability">
        <p>
          To the maximum extent permitted by law, KSEMO and its operators will
          not be liable for indirect, incidental, special, consequential, or
          punitive damages — including lost profits, data, goodwill, or business
          interruption — arising from or relating to your use of the service,
          even if advised of the possibility of such damages.
        </p>
        <p>
          Where liability cannot be excluded, it is limited, to the extent
          permitted by law, to the amount you paid us in the twelve months
          before the event giving rise to the claim (which may be zero during
          free usage). Nothing in these terms excludes liability that cannot
          lawfully be excluded, such as liability for gross negligence, willful
          misconduct, or statutory consumer guarantees.
        </p>
      </PolicySection>
      <PolicySection title="Indemnification">
        <p>
          You agree to defend and indemnify KSEMO and its operators against
          claims, damages, and reasonable costs arising from your Content, your
          use of the service in violation of these terms or applicable law, or
          the share links you publish.
        </p>
        <p>
          We will notify you promptly of any claim covered here, and you may
          control the defense with counsel we reasonably approve; we may
          participate at our own expense.
        </p>
      </PolicySection>
      <PolicySection title="Governing law and disputes">
        <p>
          These terms are governed by the laws in force at KSEMO's principal
          place of business, excluding conflict-of-law rules.
        </p>
        <p>
          If a dispute arises, please contact us first through Settings →
          Feedback: most issues can be resolved informally and quickly. Where
          informal resolution does not work within a reasonable period, the
          dispute will be brought exclusively in the courts of competent
          jurisdiction at that place of business, unless mandatory law gives you
          the right to bring claims elsewhere. Claims must be brought
          individually; nothing here prevents either party from seeking
          injunctive relief to protect intellectual property or confidential
          information.
        </p>
      </PolicySection>
      <PolicySection title="Changes to these terms">
        <p>
          We may revise these terms as the product changes. Material updates
          will be communicated in the product or on this page with a new “Last
          updated” date before they take effect.
        </p>
        <p>
          Continued use after the effective date constitutes acceptance. If you
          disagree with an update, stop using the service and remove your
          account content; the prior terms governed your use up to that point.
        </p>
      </PolicySection>
      <PolicySection title="General provisions">
        <PolicyBullets
          items={[
            <>
              Severability: if any provision is found unenforceable, the rest
              remains in force and the unenforceable part applies to the maximum
              lawful extent.
            </>,
            <>Waiver: failing to enforce a provision is not a waiver of it.</>,
            <>
              Assignment: you may not transfer these terms; we may assign them
              in connection with a merger, acquisition, or sale of assets, with
              notice.
            </>,
            <>
              Entire agreement: these terms, together with the Privacy Policy
              and in-product notices, form the whole agreement between you and
              KSEMO regarding the service.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Questions">
        <p>
          Use Help &amp; Support in your profile menu for questions about these
          terms or account access, or reach us via Settings → Feedback. We aim
          to acknowledge messages promptly and resolve substantive questions
          within a few business days.
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
