function initialsFor(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  return initials || "SC";
}

export function ProfileAvatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-24 w-24 items-center justify-center rounded-full bg-ink font-heading text-h2 text-white"
    >
      {initialsFor(name)}
    </span>
  );
}
