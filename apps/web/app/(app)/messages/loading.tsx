import { cardStyles } from "@/lib/ui";

export default function MessagesLoading() {
  return (
    <div className="mx-auto max-w-content" aria-busy="true">
      <div
        className={`${cardStyles} grid h-[calc(100dvh-11rem)] min-h-[28rem] overflow-hidden lg:h-[calc(100dvh-9rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]`}
      >
        <div className="flex flex-col gap-3 border-line p-4 lg:border-r">
          <div className="h-8 w-1/2 animate-pulse rounded-md bg-slate-100" />
          <div className="h-12 animate-pulse rounded-md bg-slate-100" />
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="flex items-center gap-3 py-2">
              <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-slate-100" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="h-4 w-2/3 animate-pulse rounded-md bg-slate-100" />
                <div className="h-4 w-full animate-pulse rounded-md bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
        <div className="hidden flex-col gap-4 bg-slate-50 p-6 lg:flex">
          <div className="h-12 w-1/2 animate-pulse rounded-md bg-slate-100" />
          <div className="h-16 w-2/3 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-16 w-1/2 animate-pulse self-end rounded-lg bg-slate-100" />
          <div className="h-16 w-2/3 animate-pulse rounded-lg bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
