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
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-5 sm:px-8">
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
      <div className="mx-auto w-full max-w-3xl px-5 pb-14 pt-10 sm:px-8 sm:pt-14">
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
        {topic === "faq" ? (
          <FaqContent />
        ) : topic === "privacy" ? (
          <PrivacyContent />
        ) : (
          <TermsContent />
        )}
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

function FaqContent() {
  const [query, setQuery] = useState("");
  const [openItems, setOpenItems] = useState<Set<string>>(() => new Set());
  const sections = useMemo(() => searchFaq(query), [query]);
  const totalMatches = sections.reduce(
    (total, section) => total + section.items.length,
    0
  );

  function toggleItem(id: string) {
    setOpenItems(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
          placeholder={`Search ${FAQ_CATEGORIES.reduce((total, category) => total + category.items.length, 0)} questions…`}
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
          ? `${totalMatches} ${totalMatches === 1 ? "question matches" : "questions match"} “${query.trim()}”`
          : `${totalMatches} questions across ${FAQ_CATEGORIES.length} topics · click any question to see the answer`}
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
                className="text-lg font-semibold tracking-[-0.02em]"
              >
                {section.category.label}
              </h2>
              <span className="text-xs text-muted-foreground">
                {section.items.length}
              </span>
            </div>
            <div className="mt-3 space-y-2.5">
              {section.items.map(item => (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-2xl border border-border bg-card"
                >
                  <button
                    onClick={() => toggleItem(item.id)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    aria-expanded={openItems.has(item.id)}
                    aria-controls={`faq-answer-${item.id}`}
                  >
                    <span className="text-[15px] font-medium leading-6">
                      {item.question}
                    </span>
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                        openItems.has(item.id) && "rotate-180"
                      )}
                      aria-hidden
                    />
                  </button>
                  {openItems.has(item.id) && (
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
              ))}
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
        "Hi! I am the KSEMO Assistant. Ask me anything about using KSEMO — voice chat, files, memories, sharing, privacy, and more.",
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
              className="size-7 rounded-lg"
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
    <section
      id={title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}
      className="scroll-mt-20"
    >
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="mt-2.5 text-sm leading-7 text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function PolicyBullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mt-1 space-y-1.5">
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
          This Privacy Policy explains what KSEMO collects, why, and the
          controls you have. In short: KSEMO stores your conversations, files,
          and memories so the product works for you, keeps them private to your
          account, and gives you explicit tools to manage or delete everything.
        </p>
      </PolicySection>
      <PolicySection title="What KSEMO stores">
        <PolicyBullets
          items={[
            <>
              Account identity from Google sign-in: your name, email address,
              and account identifier.
            </>,
            <>
              Conversations: every chat title, message text, timestamps, and
              model metadata needed to show your history.
            </>,
            <>
              Message versions: when you edit a user message or restore a
              version, prior text is retained as version history.
            </>,
            <>
              Voice transcripts: spoken turns are transcribed to text and saved
              as normal conversation messages.
            </>,
            <>
              Library files: documents and images you upload, stored as file
              bytes in private object storage linked to your account.
            </>,
            <>
              Explicit memories: only the notes you personally add in the
              Memories section, with their category and active state.
            </>,
            <>
              Preferences: selected model, response style, custom instructions,
              speech rate, autoplay, and reduce-motion settings.
            </>,
            <>
              Operational metadata: sign-in session cookies, feedback records,
              and minimal diagnostics required to run and secure the service.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="How your information is used">
        <PolicyBullets
          items={[
            <>
              To generate responses: your messages, attached files, and active
              memories are sent to the configured server-side AI service to
              produce answers.
            </>,
            <>
              To maintain history: storing conversations lets you reopen,
              search, rename, share, export, and delete them.
            </>,
            <>
              To personalize replies: active memories and your saved preferences
              shape tone, detail, and continuity across chats.
            </>,
            <>
              To keep the service safe: authentication data protects your
              session; abuse detection protects all users.
            </>,
            <>
              We do not sell your personal information, and we do not share it
              with advertising networks or data brokers.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Conversations and message history">
        <PolicyBullets
          items={[
            <>
              Conversations persist until you delete them, so your history
              survives refreshes and new sessions.
            </>,
            <>
              Archiving hides a conversation from your sidebar without deleting
              it; permanent deletion is always a separate, confirmed step.
            </>,
            <>
              Deleting a conversation permanently removes its messages; deleting
              a single message removes that message and its versions.
            </>,
            <>
              Duplicating a conversation creates an independent copy under your
              account; deleting the original does not affect the copy.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Voice input and transcripts">
        <PolicyBullets
          items={[
            <>
              When Voice Chat is active, your speech is transcribed so it can
              continue the conversation exactly like typed text.
            </>,
            <>
              Raw microphone audio is not kept as a permanent record of your
              conversations; the microphone stream ends when the voice session
              ends.
            </>,
            <>
              Transcripts are stored as message text and are covered by the same
              access, sharing, export, and deletion controls as typed messages.
            </>,
            <>
              Your browser requests microphone permission before any audio is
              captured, and you can revoke that permission at any time in
              browser settings.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Files and Library storage">
        <PolicyBullets
          items={[
            <>
              Files you add are private to your account and stored outside the
              chat database in secured object storage.
            </>,
            <>
              A file is included with an AI request only when you explicitly
              attach or select it for that conversation.
            </>,
            <>
              Removing a Library file revokes its availability, including within
              messages that previously referenced it.
            </>,
            <>
              File uploads are limited in size and type; these limits protect
              both you and the service.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Explicit memories">
        <PolicyBullets
          items={[
            <>
              Memory is opt-in: nothing is remembered automatically, and
              background scraping of your chats for memory is not performed.
            </>,
            <>
              Each memory can be disabled instantly, which stops it influencing
              responses while keeping the text for later.
            </>,
            <>
              Deleting a memory removes it permanently from future responses.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Sharing and public links">
        <PolicyBullets
          items={[
            <>
              Sharing is opt-in per conversation. Creating a public link makes
              that specific conversation viewable by anyone who has the link.
            </>,
            <>
              Shared links are read-only: visitors cannot send messages, see
              your other conversations, or access your Library or memories.
            </>,
            <>
              Disabling public sharing invalidates the existing link
              immediately.
            </>,
            <>
              Treat shared links like printed pages: remove sensitive details
              before enabling a public link.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Authentication and account security">
        <PolicyBullets
          items={[
            <>
              Sign-in uses Google's OAuth flow; KSEMO never sees or stores your
              Google password.
            </>,
            <>
              Session integrity relies on secure, signed cookies scoped to the
              KSEMO application.
            </>,
            <>
              Signing out ends the browser session; your data remains safely
              associated with your account for next time.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Service providers">
        <PolicyBullets
          items={[
            <>Google: account authentication and identity verification.</>,
            <>
              Server-side AI services: processing prompts, attachments, and
              voice transcripts to generate responses.
            </>,
            <>
              Cloud storage and hosting providers: storing Library files and
              serving the application.
            </>,
            <>
              Providers receive only what is necessary for their function, and
              this list may be updated as the service evolves.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Data retention and deletion">
        <PolicyBullets
          items={[
            <>
              You control retention: conversations, files, and memories persist
              only while you keep them.
            </>,
            <>
              Permanent deletion removes content from the active system;
              residual encrypted backups expire on the backup schedule.
            </>,
            <>
              Abandoned or suspended accounts may be purged after a prolonged
              inactive period where legally permitted, with notice where
              feasible.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Your choices and controls">
        <PolicyBullets
          items={[
            <>
              Access and export: reopen any conversation, or download it as PDF
              or Word at any time.
            </>,
            <>
              Correct: edit your own messages; earlier versions remain recorded
              for transparency.
            </>,
            <>
              Delete: remove individual messages, conversations, Library files,
              and memories permanently.
            </>,
            <>
              Restrict: disable memories, turn off autoplay speech, and avoid
              attaching files you prefer not to use.
            </>,
            <>
              Withdraw sharing: switch off any public link whenever you choose.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Security measures">
        <PolicyBullets
          items={[
            <>
              Encrypted transport for traffic between your browser and KSEMO
              services.
            </>,
            <>
              Private storage with access limited to authenticated features you
              explicitly use.
            </>,
            <>
              Least-privilege internal access and monitoring of the service for
              abuse and faults.
            </>,
            <>
              No method of transmission or storage is perfectly secure, so we
              also encourage strong Google account security and two-step
              verification.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Children's privacy">
        <p>
          KSEMO is intended for users who meet the minimum digital-consent age
          in their jurisdiction. We do not knowingly create accounts for
          children below that age; if we learn of one, we will remove the
          account and its data.
        </p>
      </PolicySection>
      <PolicySection title="International transfers">
        <p>
          Your information may be processed in countries other than your own,
          including by our service providers. Where required, appropriate
          safeguards such as standard contractual clauses apply to those
          transfers.
        </p>
      </PolicySection>
      <PolicySection title="Changes to this policy">
        <p>
          We may update this policy as KSEMO evolves. Material changes will be
          announced in the product or on this page with a revised “Last updated”
          date. Continued use after changes take effect means you accept the
          updated policy.
        </p>
      </PolicySection>
      <PolicySection title="Contact">
        <p>
          For privacy questions or account-access help, use the Help &amp;
          Support link available from your KSEMO profile menu, or email us from
          Settings → Feedback.
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
          Service. If you do not agree, please do not use the service. These
          terms apply to every feature: chat, voice, Library, memories, and
          sharing.
        </p>
      </PolicySection>
      <PolicySection title="Using KSEMO">
        <PolicyBullets
          items={[
            <>
              KSEMO is an AI assistant for conversation, voice interaction, file
              analysis, and explicitly managed memory.
            </>,
            <>
              You must use KSEMO in compliance with applicable laws and only
              through the official interfaces provided.
            </>,
            <>
              Features may evolve; we may add, change, or retire functionality
              as the product improves.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Account responsibilities">
        <PolicyBullets
          items={[
            <>
              Keep your Google account secure; you are responsible for activity
              under your session.
            </>,
            <>
              Do not share your signed-in device with people you do not trust,
              and sign out on shared computers.
            </>,
            <>
              Accounts are personal; do not resell access or provide the service
              to third parties as a bureau.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Acceptable use">
        <PolicyBullets
          items={[
            <>
              Do not upload unlawful, harmful, infringing, deceptive, or
              unauthorized material.
            </>,
            <>
              Do not attempt to disrupt, overload, reverse-engineer, or gain
              unauthorized access to the service.
            </>,
            <>
              Do not use KSEMO to generate content that harms others, violates
              their rights, or misleads them.
            </>,
            <>
              Respect other people's privacy: do not submit third-party personal
              data without a lawful basis.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="AI output">
        <PolicyBullets
          items={[
            <>
              KSEMO can produce incomplete, outdated, or inaccurate information.
              Verify important details independently.
            </>,
            <>
              Especially before legal, medical, financial, safety-related, or
              other consequential action, consult a qualified professional.
            </>,
            <>
              Generated content is not professional advice and does not create a
              professional relationship.
            </>,
            <>
              Regenerated or edited responses may differ; version history exists
              precisely so you can compare outcomes.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Your content">
        <PolicyBullets
          items={[
            <>
              You retain ownership of the content you submit: messages, files,
              and memories.
            </>,
            <>
              You grant KSEMO the limited rights needed to store, process,
              display, and transmit your content solely to operate the features
              you use.
            </>,
            <>
              You are responsible for the content you submit and for the share
              links you create.
            </>,
            <>
              Do not rely on KSEMO as your sole storage for irreplaceable files;
              exports are available for safekeeping.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Voice features">
        <PolicyBullets
          items={[
            <>
              Voice Chat transcribes your speech into conversation text;
              transcription quality depends on your environment and device.
            </>,
            <>
              Only use voice features where conversation recording is lawful and
              where everyone present consents to being transcribed.
            </>,
            <>
              Spoken turns become part of the saved conversation and follow the
              same sharing and deletion rules as typed messages.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Files and Library">
        <PolicyBullets
          items={[
            <>Upload only content you have the rights to store and process.</>,
            <>
              Size and type limits apply; attempting to circumvent them is not
              permitted.
            </>,
            <>
              Attaching a file authorizes processing of that file for the
              relevant request.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Memories">
        <PolicyBullets
          items={[
            <>
              Memories influence future responses across your account until
              disabled or deleted.
            </>,
            <>
              Only add memories you are comfortable having applied everywhere
              you chat.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Sharing links">
        <PolicyBullets
          items={[
            <>
              Public links make the chosen conversation readable by anyone with
              the link; you choose what to share.
            </>,
            <>
              You may disable any link at any time, which immediately
              invalidates it.
            </>,
            <>
              Do not publish links to content whose disclosure would violate law
              or others' rights.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Intellectual property">
        <p>
          The KSEMO name, interface, and software are protected by
          intellectual-property laws. Except where licensed otherwise, you may
          not copy or redistribute the service itself. You may freely export and
          keep your own content.
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
              Maintenance, outages, or provider issues can temporarily affect
              features, including voice.
            </>,
            <>
              We may limit or suspend access when needed to protect users,
              maintain the service, or comply with applicable requirements.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Termination">
        <PolicyBullets
          items={[
            <>
              You may stop using KSEMO at any time and sign out; deleting
              content beforehand is recommended.
            </>,
            <>
              We may suspend or terminate accounts that violate these terms or
              create risk for the service or others.
            </>,
            <>
              Sections that should survive termination — ownership, disclaimers,
              liability — do so.
            </>,
          ]}
        />
      </PolicySection>
      <PolicySection title="Disclaimers">
        <p>
          KSEMO is provided “as is” and “as available” without warranties of any
          kind, whether express or implied, including merchantability, fitness
          for a particular purpose, and non-infringement, to the maximum extent
          permitted by law.
        </p>
      </PolicySection>
      <PolicySection title="Limitation of liability">
        <p>
          To the maximum extent permitted by law, KSEMO and its operators will
          not be liable for indirect, incidental, special, consequential, or
          punitive damages, or for loss of profits, data, or goodwill arising
          from your use of the service, even if advised of the possibility of
          such damages.
        </p>
      </PolicySection>
      <PolicySection title="Changes to these terms">
        <p>
          We may revise these terms as the product changes. Material updates
          will be communicated in the product or on this page with a new “Last
          updated” date. Continued use after the effective date constitutes
          acceptance.
        </p>
      </PolicySection>
      <PolicySection title="Questions">
        <p>
          Use Help &amp; Support in your profile menu for questions about these
          terms or account access, or reach us via Settings → Feedback.
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
