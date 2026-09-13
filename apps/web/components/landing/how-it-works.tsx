import { CircleCheckIcon, FileTextIcon, HelpCircleIcon, WorkflowIcon } from "@/components/icons";
import { cardStyles, eyebrowStyles } from "@/lib/ui";

const steps = [
  {
    icon: FileTextIcon,
    title: "Build your profile in 3 minutes",
    body: "Upload your pitch deck + LinkedIn. We auto-fill the rest.",
    proof: "Auto-extracts sector, stage, ask & team size",
  },
  {
    icon: WorkflowIcon,
    title: "See matches ranked by fit",
    body: "Our AI scores every mentor and investor by how well they fit YOU.",
    proof: "Cross-evaluates cheque size, geography & thesis",
  },
  {
    icon: HelpCircleIcon,
    title: "Know exactly why each match",
    body: "Every recommendation ships with a plain-language reason. No black boxes.",
    proof: "Plain-language reasoning on every match",
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 border-y border-line bg-slate-50">
      <div className="mx-auto max-w-content px-4 py-16 md:px-6">
        <p className={eyebrowStyles}>How it works</p>
        <h2 className="mt-2">No black boxes. Just verified fit.</h2>
        <p className="mt-2 max-w-2xl text-small text-muted">
          Engineered for transparency. We reconcile your startup’s signals with each investor’s
          and mentor’s track record — and show you the reasoning.
        </p>
        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className={`${cardStyles} flex flex-col p-6`}>
              <span className="flex h-12 w-12 items-center justify-center rounded-md bg-emerald/10 text-emerald-deep">
                <step.icon className="h-6 w-6" />
              </span>
              <p className="mt-4 font-mono text-meta uppercase tracking-wider text-emerald-deep">
                Step {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-1">{step.title}</h3>
              <p className="mt-2 text-small text-muted">{step.body}</p>
              <div className="mt-auto pt-6">
                <p className="flex items-center gap-2 rounded-md border border-line bg-slate-50 px-3 py-2 text-meta text-muted">
                  <CircleCheckIcon className="h-4 w-4 shrink-0 text-emerald-deep" />
                  {step.proof}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
