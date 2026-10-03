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
import { speechReactiveService, type SpeechVisualizerState } from "@/lib/speechReactive";

export default function SharedConversation() {
  const [, params] = useRoute("/share/:token");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const token = params?.token ?? "";

  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [speechState, setSpeechState] = useState<SpeechVisualizerState>("idle");

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
    try {
      window.speechSynthesis.cancel();
      speechReactiveService.stop();
    } catch {}

    const utterance = new SpeechSynthesisUtterance(text);
    setSpeakingMessageId(messageId);
    setSpeechState("buffering");

    speechReactiveService.bindUtterance(utterance, messageId, text, {
      onStart: () => setSpeechState("playing"),
      onEnd: () => {
        setSpeakingMessageId(null);
        setSpeechState("idle");
      },
      onError: () => {
        setSpeakingMessageId(null);
        setSpeechState("idle");
      },
      onPause: () => setSpeechState("paused"),
      onResume: () => setSpeechState("playing"),
    });

    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      speechReactiveService.stop();
      setSpeakingMessageId(null);
      setSpeechState("idle");
    }
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
    speechReactiveService.stop();
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
    <div className="relative flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Project name — non-clickable static label on the top-left */}
      <div className="pointer-events-none absolute left-4 top-3.5 z-20 select-none">
        <span className="text-base font-semibold tracking-[-0.02em] text-foreground">
          KSEMO
        </span>
      </div>

      {/* Top-right action buttons matching the workspace after sign out */}
      {user ? (
        <div className="absolute right-3 top-2.5 z-20 flex items-center gap-2">
          <Button
            onClick={handleContinueChat}
            disabled={forkMutation.isPending}
            className="h-9 rounded-lg bg-[oklch(0.95_0.003_80)] text-[oklch(0.21_0.008_80)] shadow-sm transition-colors duration-150 hover:bg-[oklch(0.93_0.003_80)] active:scale-[0.98]"
          >
            <span className="inline-flex items-center gap-1.5 text-sm font-medium">
              <Sparkles className="size-4" />
              Continue this chat
            </span>
          </Button>
        </div>
      ) : (
        <div className="absolute right-3 top-2.5 z-20 flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              setLocation(
                `/signup?redirect=${encodeURIComponent(
                  window.location.pathname
                )}`
              )
            }
            className="h-9 rounded-lg border-border text-foreground transition-colors duration-150 hover:border-transparent hover:bg-[oklch(0.21_0.008_80)] hover:text-[oklch(0.95_0.003_80)] active:scale-[0.98]"
            aria-label="Create account"
            data-testid="guest-create-account-button"
          >
            <span className="inline-flex items-center gap-1.5 text-sm font-medium">
              <UserPlus className="size-4" />
              Create account
            </span>
          </Button>
          <Button
            onClick={() =>
              setLocation(
                `/signin?redirect=${encodeURIComponent(
                  window.location.pathname
                )}`
              )
            }
            className="h-9 rounded-lg bg-[oklch(0.95_0.003_80)] text-[oklch(0.21_0.008_80)] shadow-sm transition-colors duration-150 hover:bg-[oklch(0.93_0.003_80)] active:scale-[0.98]"
            aria-label="Sign in"
            data-testid="guest-sign-in-button"
          >
            <span className="inline-flex items-center gap-1.5 text-sm font-medium">
              <LogIn className="size-4" />
              Sign in
            </span>
          </Button>
        </div>
      )}

      {/* Main Conversation Thread — Authentic KSEMO Chat Workspace UI */}
      <section
        className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-16 sm:px-6 sm:pt-16"
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
