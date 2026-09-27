import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { buttonStyles } from "@/lib/ui";

import { MobileMenu } from "./mobile-menu";

export const landingNavLinks = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#for-founders", label: "For Founders" },
  { href: "/for-investors", label: "For Investors" },
  { href: "/for-mentors", label: "For Mentors" },
] as const;

type SiteHeaderProps = {
  /** Role landing pages pass their own in-page anchors. */
  links?: ReadonlyArray<{ href: string; label: string }>;
};

export function SiteHeader({ links = landingNavLinks }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-content items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Logo />
        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="rounded-md text-small text-muted transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/sign-in" className={buttonStyles.ghost}>
            Sign in
          </Link>
          <Link href="/sign-up" className={buttonStyles.primary}>
            Get started
          </Link>
        </div>
        <MobileMenu links={links} />
      </div>
    </header>
  );
}
