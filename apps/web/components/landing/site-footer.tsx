import Link from "next/link";

import { Logo } from "@/components/brand/logo";

const footerColumns = [
  {
    title: "Product",
    links: [
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#for-founders", label: "For founders" },
      { href: "/for-investors", label: "For investors" },
      { href: "/for-mentors", label: "For mentors" },
      { href: "/sign-up", label: "Get started" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto max-w-content px-4 py-12 md:px-6">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <Logo tone="light" />
            <p className="mt-3 max-w-xs text-small text-white/70">
              AI matching for early-stage Indian founders, investors, and mentors — every match
              explained.
            </p>
          </div>
          {footerColumns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="font-sans text-small font-semibold text-white">{column.title}</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="rounded-md text-small text-white/70 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="mt-12 border-t border-white/10 pt-6 text-center text-meta text-white/60">
          © {new Date().getFullYear()} Startup Connect AI. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
