import type { ProblemDetail } from "@/lib/api-types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: ProblemDetail | null,
  ) {
    super(problem?.detail ?? problem?.title ?? `API request failed with status ${status}`);
    this.name = "ApiError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST";
  token: string;
  body?: unknown;
};

export async function apiRequest<T>(
  path: string,
  { method = "GET", token, body }: RequestOptions,
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not set");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const isJson = response.headers.get("content-type")?.includes("json") ?? false;
    const problem = isJson ? ((await response.json()) as ProblemDetail) : null;
    throw new ApiError(response.status, problem);
  }

  return (await response.json()) as T;
}
