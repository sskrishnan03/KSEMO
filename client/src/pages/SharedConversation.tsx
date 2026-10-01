import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loading } from "@/components/ui/loading";
import { Button } from "@/components/ui/button";
import {
  MessageCircle,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  LogIn,
} from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

export default function SharedConversation() {
  const [, params] = useRoute("/share/:token");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const token = params?.token ?? "";
  const [copied, setCopied] = useState(false);

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

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleContinueChat = () => {
    if (user) {
      forkMutation.mutate({ token });
    } else {
      setLocation(`/signin?redirect=${encodeURIComponent(window.location.pathname)}`);
    }
  };

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
          <h1 className="mt-4 font-serif text-2xl tracking-[-0.03em] text-foreground">
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
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/80 backdrop-blur-md px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 text-foreground font-semibold hover:opacity-80 transition-opacity cursor-pointer shrink-0"
          >
            <span className="font-serif text-lg tracking-tight">KSEMO</span>
          </button>
          <span className="text-xs rounded-full bg-muted px-2.5 py-0.5 font-medium text-muted-foreground shrink-0">
            Shared Chat
          </span>
          <span className="text-sm font-medium text-muted-foreground truncate hidden md:inline-block">
            {conversation.title}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyLink}
            className="h-8 gap-1.5 rounded-lg px-2.5 text-xs cursor-pointer text-muted-foreground hover:text-foreground"
          >
            {copied ? (
              <Check className="size-3.5 text-green-500" />
            ) : (
              <Copy className="size-3.5" />
            )}
            <span className="hidden sm:inline">Copy link</span>
          </Button>

          <Button
            size="sm"
            onClick={handleContinueChat}
            disabled={forkMutation.isPending}
            className="h-8 gap-1.5 rounded-lg px-3 text-xs font-medium bg-foreground text-background hover:bg-foreground/90 transition-all cursor-pointer shadow-xs"
          >
            {user ? (
              <>
                <Sparkles className="size-3.5" />
                <span>Continue this chat</span>
              </>
            ) : (
              <>
                <LogIn className="size-3.5" />
                <span>Log in to continue</span>
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Main Messages Thread */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 sm:px-6 sm:py-12 space-y-6">
        <div className="border-b border-border pb-5 space-y-2">
          <h1 className="font-serif text-2xl sm:text-3xl font-medium tracking-tight text-foreground">
            {conversation.title}
          </h1>
          <p className="text-xs text-muted-foreground">
            {messages.length} {messages.length === 1 ? "message" : "messages"} · Shared from KSEMO
          </p>
        </div>

        <div className="space-y-6">
          {messages.map((message: any) => {
            const isUser = message.role === "user";
            return (
              <article
                key={message.id}
                className={
                  isUser
                    ? "ml-auto max-w-[85%] rounded-2xl bg-muted/80 px-4 py-3 border border-border/50 text-foreground"
                    : "max-w-3xl rounded-2xl bg-card border border-border/60 p-4 sm:p-5 text-card-foreground shadow-xs"
                }
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {isUser ? "You" : "KSEMO"}
                  </span>
                </div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed sm:text-[15px]">
                  {message.content}
                </div>
              </article>
            );
          })}
        </div>

        {/* Bottom CTA Card */}
        <section className="mt-12 rounded-2xl border border-border bg-muted/40 p-6 text-center space-y-3">
          <h2 className="text-base font-medium text-foreground">
            Continue this conversation
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
            {user
              ? "Pick up where this chat left off, ask follow-up questions, or edit any message in your own workspace."
              : "Sign in to KSEMO to branch this conversation, edit responses, and explore further."}
          </p>
          <div className="pt-2 flex justify-center">
            <Button
              onClick={handleContinueChat}
              disabled={forkMutation.isPending}
              className="gap-2 rounded-xl text-sm font-medium bg-foreground text-background hover:bg-foreground/90 cursor-pointer shadow-sm"
            >
              {user ? (
                <>
                  <span>Continue this chat</span>
                  <ArrowRight className="size-4" />
                </>
              ) : (
                <>
                  <LogIn className="size-4" />
                  <span>Log in to continue</span>
                </>
              )}
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
