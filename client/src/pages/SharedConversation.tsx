import { trpc } from "@/lib/trpc";
import { MessageCircle } from "lucide-react";
import { useRoute } from "wouter";

export default function SharedConversation() {
  const [, params] = useRoute("/share/:token");
  const token = params?.token ?? "";
  const shared = trpc.conversation.getPublic.useQuery(
    { token },
    { enabled: token.length >= 16 }
  );

  if (shared.isLoading)
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <div className="size-7 animate-pulse rounded-xl bg-foreground" />
      </main>
    );
  if (shared.isError || !shared.data)
    return (
      <main className="grid min-h-screen place-items-center bg-background px-5">
        <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center">
          <MessageCircle className="mx-auto size-6 text-muted-foreground" />
          <h1 className="mt-4 font-serif text-3xl tracking-[-0.04em]">
            This shared chat is unavailable
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            It may have been unpublished or removed by its owner.
          </p>
        </section>
      </main>
    );

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 sm:py-12">
      <section className="mx-auto max-w-3xl">
        <div className="mb-8 border-b border-border pb-5">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Shared from KSEMO
          </p>
          <h1 className="mt-2 font-serif text-3xl tracking-[-0.04em] sm:text-4xl">
            {shared.data.conversation.title}
          </h1>
        </div>
        <div className="space-y-6">
          {shared.data.messages.map((message: any) => (
            <article
              key={message.id}
              className={
                message.role === "user"
                  ? "ml-auto max-w-[85%] rounded-2xl bg-muted px-4 py-3"
                  : "max-w-3xl px-1 py-2"
              }
            >
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {message.role === "user" ? "You" : "KSEMO"}
              </p>
              <p className="whitespace-pre-wrap text-sm leading-7 sm:text-[15px]">
                {message.content}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
