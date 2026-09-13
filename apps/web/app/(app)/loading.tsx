export default function AppLoading() {
  return (
    <div aria-busy="true" className="mx-auto flex max-w-content flex-col gap-6">
      <span className="sr-only">Loading</span>
      <div className="h-8 w-1/3 animate-pulse rounded-md bg-line" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-line" />
      <div className="h-24 animate-pulse rounded-lg bg-line" />
      <div className="h-24 animate-pulse rounded-lg bg-line" />
    </div>
  );
}
