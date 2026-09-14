"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { SearchIcon } from "@/components/icons";

import { SearchPanel } from "./search-panel";

import type { AppRole } from "@/lib/api-types";

// S2 AC1: the top-bar search opens the S-21 modal; Cmd/Ctrl-K opens it from any page.
export function SearchLauncher({ role }: { role: AppRole }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [shortcut, setShortcut] = useState("Ctrl K");

  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.userAgent)) setShortcut("⌘K");
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-keyshortcuts="Control+K Meta+K"
        className="hidden items-center gap-2 rounded-md border border-line bg-slate-50 px-3 py-2 text-small text-muted hover:border-muted md:flex"
      >
        <SearchIcon />
        Find investors, founders…
        <kbd className="ml-2 rounded border border-line bg-white px-1 font-mono text-meta" suppressHydrationWarning>
          {shortcut}
        </kbd>
      </button>
      <Link
        href="/search"
        aria-label="Search"
        className="flex h-12 w-12 items-center justify-center rounded-md text-ink hover:bg-slate-50 md:hidden"
      >
        <SearchIcon className="h-6 w-6" />
      </Link>
      <dialog
        ref={dialogRef}
        aria-label="Search"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
        className="mx-auto mt-24 w-full max-w-modal overflow-hidden rounded-xl border border-line bg-white p-0 shadow-card backdrop:bg-ink/40"
      >
        {open ? (
          <SearchPanel role={role} variant="dialog" onNavigate={() => setOpen(false)} />
        ) : null}
      </dialog>
    </>
  );
}
