import { cardStyles } from "@/lib/ui";

export default function MeetingOutcomeLoading() {
  return (
    <div className="mx-auto flex max-w-onboarding flex-col gap-6" aria-busy="true">
      <div className="h-4 w-1/4 animate-pulse rounded-md bg-slate-100" />
      <div className="h-8 w-2/3 animate-pulse rounded-md bg-slate-100" />
      <div className={`${cardStyles} h-24 animate-pulse`} />
      <div className={`${cardStyles} flex flex-col gap-3 p-6`}>
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
        <div className="h-24 animate-pulse rounded-md bg-slate-100" />
      </div>
    </div>
  );
}
