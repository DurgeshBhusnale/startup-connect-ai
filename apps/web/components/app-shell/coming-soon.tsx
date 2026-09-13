import { EmptyState } from "@/components/ui/empty-state";
import { cardStyles } from "@/lib/ui";

import type { ReactNode } from "react";

type ComingSoonProps = {
  title: string;
  body: string;
  icon: ReactNode;
};

export function ComingSoon({ title, body, icon }: ComingSoonProps) {
  return (
    <div className="mx-auto flex max-w-content flex-col gap-6">
      <h1>{title}</h1>
      <section className={`${cardStyles} p-6`}>
        <EmptyState
          icon={icon}
          title="Coming soon"
          body={body}
          action={{ href: "/home", label: "Back to Home" }}
        />
      </section>
    </div>
  );
}
