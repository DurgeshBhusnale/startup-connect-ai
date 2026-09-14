import { cardStyles } from "@/lib/ui";

export default function MatchesLoading() {
  return (
    <div className="mx-auto flex max-w-content flex-col gap-6" aria-busy="true">
      <div className="flex flex-col gap-2 border-b border-line pb-6">
        <div className="h-8 w-1/3 animate-pulse rounded-md bg-slate-100" />
        <div className="h-4 w-1/2 animate-pulse rounded-md bg-slate-100" />
      </div>
      <p className="text-small text-muted" role="status">
        Finding matches for you…
      </p>
      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <li key={item} className={`${cardStyles} flex flex-col gap-4 p-6`}>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 animate-pulse rounded-full bg-slate-100" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="h-4 w-1/2 animate-pulse rounded-md bg-slate-100" />
                <div className="h-3 w-2/3 animate-pulse rounded-md bg-slate-100" />
              </div>
            </div>
            <div className="h-16 animate-pulse rounded-md bg-slate-100" />
          </li>
        ))}
      </ul>
    </div>
  );
}
