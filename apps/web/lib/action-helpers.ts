import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ApiError } from "@/lib/api";

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export async function requireToken(): Promise<string> {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    redirect("/sign-in");
  }
  return token;
}

// Client-facing problem details are shown as-is; anything unexpected gets a generic message.
export function actionFailure(error: unknown, fallback: string): { ok: false; error: string } {
  if (error instanceof ApiError && error.status < 500 && error.problem?.detail) {
    return { ok: false, error: error.problem.detail };
  }
  console.error(fallback, error);
  return { ok: false, error: fallback };
}
