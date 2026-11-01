import { BadgeCheck, BellRing, CalendarRange, EyeOff, PackagePlus, Repeat, Search } from "lucide-react";
import { CtaAction, HeroActions } from "@/components/home/HeroActions";
import { HeroPreview } from "@/components/home/HeroPreview";
import { PublicToolList } from "@/components/home/PublicToolList";

const steps = [
  {
    icon: PackagePlus,
    title: "List a tool",
    text: "Add a name, category, condition, and short description. Edit or remove it at any time.",
  },
  {
    icon: Search,
    title: "Request dates",
    text: "Find the tool you need and ask to borrow it for the days that suit you.",
  },
  {
    icon: Repeat,
    title: "Approve and return",
    text: "The owner approves or declines. When the tool comes back, the owner marks it returned.",
  },
];

const features = [
  {
    icon: CalendarRange,
    title: "Availability at a glance",
    text: "Every tool shows if it is available, on loan, or overdue.",
  },
  {
    icon: BellRing,
    title: "Overdue reminders",
    text: "If a loan runs late, the borrower gets a daily reminder until the tool is back.",
  },
  {
    icon: BadgeCheck,
    title: "Trusted Lenders",
    text: "Reliable lenders get a Trusted Lender badge, so you know who you borrow from.",
  },
  {
    icon: EyeOff,
    title: "Private by default",
    text: "Visitors see only tool names and categories. Neighbors see your name, never your email.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <div className="relative isolate overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_15%_0%,color-mix(in_oklch,var(--primary)_22%,transparent),transparent)]"
        />
        <section className="mx-auto grid w-full max-w-5xl items-center gap-12 px-6 pt-12 pb-20 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
          <div className="flex flex-col gap-6">
            <p className="w-fit rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              Neighborhood tool lending
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Borrow what you need. <span className="text-primary">Lend what you don&apos;t.</span>
            </h1>
            <p className="max-w-prose text-lg text-pretty text-muted-foreground">
              A drill or a ladder can sit in a garage for months. LendLoop lets neighbors list the tools
              they can lend, borrow them for a few days, and keep track of every loan.
            </p>
            <HeroActions />
          </div>
          <HeroPreview />
        </section>
      </div>

      <section className="border-y bg-secondary/60">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
          <ol className="grid gap-8 sm:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="flex flex-col gap-3">
                <span className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                    <step.icon aria-hidden className="size-5" />
                  </span>
                  <span className="text-sm font-semibold text-primary">Step {index + 1}</span>
                </span>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="tools" className="mx-auto flex w-full max-w-5xl scroll-mt-8 flex-col gap-6 px-6 py-16">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">Tools in the neighborhood</h2>
          <p className="text-muted-foreground">Sign in to see availability and request a tool.</p>
        </div>
        <PublicToolList />
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 pb-16">
        <ul className="grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <li key={feature.title} className="flex gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10 transition-colors hover:ring-primary/40">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <feature.icon aria-hidden className="size-5" />
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 pb-20">
        <div className="flex flex-col items-start gap-6 rounded-2xl bg-linear-to-br from-primary to-[color-mix(in_oklch,var(--primary),black_25%)] p-8 text-primary-foreground shadow-lg sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">Have a ladder you use twice a year?</h2>
            <p className="opacity-80">Lend it to a neighbor. Borrow something back when you need it.</p>
          </div>
          <CtaAction />
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">LendLoop</span>
          <span>Neighborhood tool lending</span>
        </div>
      </footer>
    </main>
  );
}
