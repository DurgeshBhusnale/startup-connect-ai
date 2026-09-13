"use client";

import { useEffect, useState } from "react";

function salutationFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// Time-of-day depends on the viewer's clock, so it resolves after hydration.
export function Greeting({ firstName }: { firstName: string | null }) {
  const [salutation, setSalutation] = useState("Welcome");

  useEffect(() => {
    setSalutation(salutationFor(new Date().getHours()));
  }, []);

  return <h1>{firstName ? `${salutation}, ${firstName}` : salutation}</h1>;
}
