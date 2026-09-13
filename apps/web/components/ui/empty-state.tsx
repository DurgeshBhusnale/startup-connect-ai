import Link from "next/link";

import { buttonStyles } from "@/lib/ui";

import type { ReactNode } from "react";

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  body: string;
  action?: { href: string; label: string };
};

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-empty flex-col items-center py-12 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald/10 text-emerald">
        {icon}
      </span>
      <h2 className="mt-4 text-h3">{title}</h2>
      <p className="mt-2 text-small text-muted">{body}</p>
      {action ? (
        <Link href={action.href} className={`${buttonStyles.primary} mt-6`}>
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
