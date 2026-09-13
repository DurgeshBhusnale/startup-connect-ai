import { AuthShell } from "@/components/auth/auth-shell";

export default function OnboardingLoading() {
  return (
    <AuthShell>
      <div
        aria-busy="true"
        className="w-full max-w-auth-card rounded-lg border border-line bg-white p-8 shadow-card"
      >
        <span className="sr-only">Loading your account</span>
        <div className="h-8 w-1/2 animate-pulse rounded-md bg-slate-100" />
        <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-slate-100" />
        {[0, 1, 2].map((row) => (
          <div key={row} className="mt-4 h-24 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    </AuthShell>
  );
}
