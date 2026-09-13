export function FitBadge({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center rounded border border-emerald/30 bg-emerald-bright/10 px-2 py-1 font-mono text-meta font-medium uppercase text-emerald-deep">
      {value}% fit
    </span>
  );
}
