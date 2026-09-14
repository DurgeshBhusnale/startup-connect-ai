import { cardStyles } from "@/lib/ui";

export default function MatchDetailLoading() {
  return (
    <div className="mx-auto flex max-w-content flex-col gap-6" aria-busy="true">
      <div className="h-4 w-24 animate-pulse rounded-md bg-slate-100" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
        <div className={`${cardStyles} flex flex-col items-center gap-4 p-6`}>
          <div className="h-24 w-24 animate-pulse rounded-full bg-slate-100" />
          <div className="h-6 w-40 animate-pulse rounded-md bg-slate-100" />
          <div className="h-4 w-48 animate-pulse rounded-md bg-slate-100" />
          <p role="status" className="text-small text-muted">
            Loading match…
          </p>
        </div>
        <div className="flex flex-col gap-6">
          <div className="h-12 animate-pulse rounded-md bg-slate-100" />
          <div className={`${cardStyles} flex flex-col gap-3 p-6`}>
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-4 animate-pulse rounded-md bg-slate-100" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
