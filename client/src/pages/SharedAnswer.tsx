import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui/loading";
import { trpc } from "@/lib/trpc";
import Home from "@/pages/Home";
import { useRoute } from "wouter";

function readLegacyAnswer() {
  try {
    return decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return window.location.hash.slice(1);
  }
}

export default function SharedAnswer() {
  const [hasToken, params] = useRoute("/share-answer/:token");
  const token = hasToken ? params?.token : undefined;
  const answerQuery = trpc.conversation.getSharedAnswer.useQuery(
    { token: token ?? "" },
    { enabled: Boolean(token), retry: 1 }
  );

  if (!token) {
    return <Home sharedAnswer={readLegacyAnswer()} />;
  }

  if (answerQuery.isLoading) return <Loading fullScreen />;

  if (answerQuery.isError || !answerQuery.data?.content) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-5 text-foreground">
        <section className="max-w-md text-center">
          <h1 className="text-lg font-semibold">This shared answer is unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The link may be invalid or the answer may have been removed.
          </p>
          <Button
            className="mt-5 rounded-xl"
            onClick={() => (window.location.href = "/")}
          >
            Open KSEMO
          </Button>
        </section>
      </main>
    );
  }

  return (
    <Home
      sharedAnswer={answerQuery.data.content}
      sharedAnswerToken={token}
    />
  );
}
