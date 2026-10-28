import { Check, X } from "lucide-react";
import { useLocation } from "wouter";

const plans = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    summary: "Everything you need to get started with KSEMO.",
    features: [
      "Everyday AI conversations",
      "Standard usage limits",
      "Chat history and search",
      "Core writing and chat tools",
      "Basic file uploads",
    ],
    action: "Your current plan",
    current: true,
  },
  {
    name: "Plus",
    price: "$8",
    cadence: "per month",
    summary: "More room for daily work, study, and creative projects.",
    features: [
      "More messages for longer sessions",
      "More file uploads and larger documents",
      "Create Word, PDF, and presentation files",
      "Voice conversations",
      "Faster access when demand is high",
    ],
    action: "Choose Plus",
    featured: true,
  },
  {
    name: "Pro",
    price: "$18",
    cadence: "per month",
    summary: "For demanding workflows and frequent, in-depth work.",
    features: [
      "Highest message and upload limits",
      "In-depth research tools",
      "Extended voice sessions",
      "Long context for complex work",
      "Early access to new capabilities",
    ],
    action: "Choose Pro",
  },
];

export default function UpgradePage() {
  const [, setLocation] = useLocation();
  return (
    <main className="min-h-dvh overflow-y-auto bg-background px-5 py-6 text-foreground sm:px-8 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setLocation("/")}
            className="inline-flex size-10 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label="Cancel and return to chat"
            title="Cancel"
          >
            <X className="size-4" />
          </button>
        </div>
        <header className="mx-auto mt-4 max-w-2xl text-center sm:mt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            KSEMO plans
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
            Choose your workspace.
          </h1>
        </header>
        <section
          aria-label="Choose a plan"
          className="mx-auto mt-6 grid max-w-6xl gap-4 md:mt-8 md:grid-cols-3 md:gap-5"
        >
          {plans.map(plan => (
            <article
              key={plan.name}
              className={`relative flex flex-col rounded-3xl border p-5 sm:p-6 ${plan.featured ? "border-foreground/50 bg-card shadow-xl shadow-black/10 ring-1 ring-foreground/10 md:-translate-y-1" : "border-border bg-card/70"}`}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-foreground px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-background">
                  Plus · Best value
                </span>
              )}
              <h2 className="text-lg font-semibold">{plan.name}</h2>
              <p className="mt-2 min-h-10 text-sm leading-5 text-muted-foreground">
                {plan.summary}
              </p>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-4xl font-semibold tracking-[-0.05em]">
                  {plan.price}
                </span>
                <span className="text-xs text-muted-foreground">
                  {plan.cadence}
                </span>
              </div>
              <button
                type="button"
                disabled={plan.current}
                className={`mt-6 flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold transition ${plan.featured ? "bg-foreground text-background hover:bg-foreground/90" : plan.current ? "border border-border bg-background text-muted-foreground" : "border border-border bg-background hover:bg-accent"}`}
              >
                {plan.action}
              </button>
              <div className="my-6 h-px bg-border" />
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Plan includes
              </p>
              <ul className="space-y-3.5 text-sm">
                {plan.features.map(feature => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 leading-5"
                  >
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
