import Link from "next/link";

export type ProfileTab = {
  key: string;
  label: string;
  count?: number;
};

type ProfileTabsProps = {
  tabs: readonly ProfileTab[];
  active: string;
  basePath?: string;
  label?: string;
};

export function ProfileTabs({
  tabs,
  active,
  basePath = "/profile",
  label = "Profile sections",
}: ProfileTabsProps) {
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((tab, index) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={index === 0 ? basePath : `${basePath}?tab=${tab.key}`}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-small font-medium transition-colors ${
              isActive
                ? "border-emerald-deep text-emerald-deep"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className="rounded-full bg-slate-100 px-2 font-mono text-meta text-ink">
                {tab.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
