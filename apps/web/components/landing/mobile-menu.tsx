"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { MenuIcon, XIcon } from "@/components/icons";
import { buttonStyles } from "@/lib/ui";

type MobileMenuProps = {
  links: ReadonlyArray<{ href: string; label: string }>;
};

export function MobileMenu({ links }: MobileMenuProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="landing-mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
        className="flex h-12 w-12 items-center justify-center rounded-md text-ink hover:bg-slate-50"
      >
        {open ? <XIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
      </button>
      {open ? (
        <div
          id="landing-mobile-menu"
          className="absolute inset-x-0 top-full border-b border-line bg-white px-4 pb-6 pt-2 shadow-card"
        >
          <nav aria-label="Mobile" className="flex flex-col">
            {links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={close}
                className="rounded-md px-3 py-3 text-base text-ink hover:bg-slate-50"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-2">
            <Link href="/sign-in" onClick={close} className={buttonStyles.secondary}>
              Sign in
            </Link>
            <Link href="/sign-up" onClick={close} className={buttonStyles.primary}>
              Get started free
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
