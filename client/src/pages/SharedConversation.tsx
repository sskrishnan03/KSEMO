import React, { useCallback, useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loading } from "@/components/ui/loading";
import { Button } from "@/components/ui/button";
import {
  MessageCircle,
  Sparkles,
  LogIn,
  UserPlus,
} from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { MessageContent, type KsemoMessage } from "@/components/ksemo/MessageContent";

export default function SharedConversation() {
  const [, params] = useRoute("/share/:token");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const token = params?.token ?? "";

  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [speechState, setSpeechState] = useState<"idle" | "playing" | "paused">("idle");

  const shared = trpc.conversation.getPublic.useQuery(
    { token },
    { enabled: token.length >= 16, retry: 1 }
  );

  const forkMutation = trpc.conversation.forkShared.useMutation({
    onSuccess: data => {
      toast.success("Conversation added to your chats");
      setLocation(`/c/${encodeURIComponent(data.conversationId)}`);
    },
    onError: () => {
      toast.error("Could not continue this conversation. Please try again.");
    },
  });

  // If the logged-in user is the owner of this conversation, seamlessly open it in their workspace!
  useEffect(() => {
    if (shared.data?.conversation.isOwner && shared.data.conversation.id) {
      setLocation(`/c/${encodeURIComponent(shared.data.conversation.id)}`);
    }
  }, [shared.data?.conversation.isOwner, shared.data?.conversation.id, setLocation]);

  const handleContinueChat = () => {
    if (user) {
      forkMutation.mutate({ token });
    } else {
      setLocation(`/signin?redirect=${encodeURIComponent(window.location.pathname)}`);
    }
  };

  const handleSpeak = useCallback((text: string, messageId: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => {
      setSpeakingMessageId(null);
      setSpeechState("idle");
    };
    utterance.onerror = () => {
      setSpeakingMessageId(null);
      setSpeechState("idle");
    };
    setSpeakingMessageId(messageId);
    setSpeechState("playing");
    window.speechSynthesis.speak(utterance);
  }, []);

  const handlePause = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.pause();
      setSpeechState("paused");
    }
  }, []);

  const handleResume = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.resume();
      setSpeechState("playing");
    }
  }, []);

  const handleStop = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      setSpeechState("idle");
    }
  }, []);

  if (shared.isLoading) {
    return <Loading fullScreen />;
  }

  // If the user is the owner and redirect is happening, show brief transition
  if (shared.data?.conversation.isOwner) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loading />
          <p className="text-sm text-muted-foreground">Opening your chat…</p>
        </div>
      </main>
    );
  }

  if (shared.isError || !shared.data) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-5">
        <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
          <MessageCircle className="mx-auto size-8 text-muted-foreground/60" />
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
            This shared chat is unavailable
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            It may have been unpublished, made private, or removed by its owner.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/")}
              className="rounded-xl cursor-pointer"
            >
              Go to KSEMO
            </Button>
          </div>
        </section>
      </main>
    );
  }

  const { conversation, messages } = shared.data;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Top Header — Clean navbar with only project name on the left */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border/80 bg-background/80 px-4 backdrop-blur-md sm:px-6">
        <div className="flex min-w-0 items-center">
          <button
            type="button"
            onClick={() => setLocation("/")}
            className="flex items-center rounded-lg transition-opacity hover:opacity-85 focus-visible:outline-none"
            aria-label="KSEMO Home"
          >
            <span className="text-base font-semibold tracking-[-0.02em] text-foreground">
              KSEMO
            </span>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {user ? (
            <Button
              size="sm"
              onClick={handleContinueChat}
              disabled={forkMutation.isPending}
              className="h-8.5 gap-2 rounded-xl bg-foreground px-3.5 text-xs font-semibold text-background shadow-xs transition-all hover:bg-foreground/90 active:scale-[0.98]"
            >
              <Sparkles className="size-3.5" />
              <span>Continue this chat</span>
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setLocation(
                    `/signup?redirect=${encodeURIComponent(
                      window.location.pathname
                    )}`
                  )
                }
                className="h-8.5 rounded-xl border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent active:scale-[0.98]"
              >
                <UserPlus className="mr-1.5 size-3.5" />
                Create account
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  setLocation(
                    `/signin?redirect=${encodeURIComponent(
                      window.location.pathname
                    )}`
                  )
                }
                className="h-8.5 rounded-xl bg-foreground px-3.5 text-xs font-medium text-background shadow-xs transition-colors hover:bg-foreground/90 active:scale-[0.98]"
              >
                <LogIn className="mr-1.5 size-3.5" />
                Sign in
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Main Conversation Thread — Authentic KSEMO Chat Workspace UI */}
      <section
        className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6"
        aria-label="Shared conversation"
      >
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="border-b border-border/60 pb-4 space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {conversation.title}
            </h1>
            <p className="text-xs text-muted-foreground">
              {messages.length} {messages.length === 1 ? "message" : "messages"} · Shared from KSEMO
            </p>
          </div>

          <div className="space-y-5">
            {messages.map((message: any) => {
              const ksemoMessage: KsemoMessage = {
                id: message.id,
                role: message.role as "user" | "assistant",
                content: message.content,
                status: "completed",
              };
              return (
                <MessageContent
                  key={message.id}
                  message={ksemoMessage}
                  onSpeak={handleSpeak}
                  onPause={handlePause}
                  onResume={handleResume}
                  onStop={handleStop}
                  isSpeaking={speakingMessageId === message.id}
                  speechState={speechState}
                />
              );
            })}
          </div>
        </div>
      </section>

      {/* Bottom Composer Dock — Sign In / Continue prompt styled as Workspace Input */}
      <div className="shrink-0 border-t border-border/50 bg-background/80 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto max-w-3xl">
          {!user ? (
            <div
              onClick={() =>
                setLocation(
                  `/signin?redirect=${encodeURIComponent(
                    window.location.pathname
                  )}`
                )
              }
              className="group flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border bg-card/80 p-3 shadow-xs transition-all hover:border-foreground/30 hover:bg-card hover:shadow-md sm:p-3.5"
              role="button"
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setLocation(
                    `/signin?redirect=${encodeURIComponent(
                      window.location.pathname
                    )}`
                  );
                }
              }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-foreground group-hover:text-background">
                  <LogIn className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    Sign in to continue this chat
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    After signing in, you can edit, branch, or ask follow-up questions.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={e => {
                  e.stopPropagation();
                  setLocation(
                    `/signin?redirect=${encodeURIComponent(
                      window.location.pathname
                    )}`
                  );
                }}
                className="h-8 shrink-0 rounded-xl bg-foreground px-3.5 text-xs font-semibold text-background shadow-xs transition-all hover:bg-foreground/90"
              >
                Sign in
              </Button>
            </div>
          ) : (
            <div
              onClick={handleContinueChat}
              className="group flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border bg-card/80 p-3 shadow-xs transition-all hover:border-foreground/30 hover:bg-card hover:shadow-md sm:p-3.5"
              role="button"
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleContinueChat();
                }
              }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-foreground group-hover:text-background">
                  <Sparkles className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    Continue this conversation in your workspace
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Pick up where this chat left off, edit messages, or ask follow-ups.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={e => {
                  e.stopPropagation();
                  handleContinueChat();
                }}
                disabled={forkMutation.isPending}
                className="h-8 shrink-0 rounded-xl bg-foreground px-3.5 text-xs font-semibold text-background shadow-xs transition-all hover:bg-foreground/90"
              >
                {forkMutation.isPending ? "Opening…" : "Continue chat"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
