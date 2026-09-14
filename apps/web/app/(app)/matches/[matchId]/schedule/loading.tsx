import { cardStyles } from "@/lib/ui";

export default function ScheduleLoading() {
  return (
    <div className="mx-auto flex max-w-content flex-col gap-6" aria-busy="true">
      <div className="h-4 w-1/4 animate-pulse rounded-md bg-slate-100" />
      <div className="h-8 w-1/3 animate-pulse rounded-md bg-slate-100" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className={`${cardStyles} flex flex-col items-center gap-3 p-6`}>
          <div className="h-16 w-16 animate-pulse rounded-full bg-slate-100" />
          <div className="h-6 w-1/2 animate-pulse rounded-md bg-slate-100" />
          <div className="h-4 w-2/3 animate-pulse rounded-md bg-slate-100" />
        </div>
        <div className={`${cardStyles} flex flex-col gap-3 p-6`}>
          <div className="h-6 w-1/2 animate-pulse rounded-md bg-slate-100" />
          <div className="aspect-video animate-pulse rounded-md bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
