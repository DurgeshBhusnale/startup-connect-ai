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

function apiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not set");
  }
  return baseUrl;
}

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const isJson = response.headers.get("content-type")?.includes("json") ?? false;
    const problem = isJson ? ((await response.json()) as ProblemDetail) : null;
    throw new ApiError(response.status, problem);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  token: string;
  body?: unknown;
};

export async function apiRequest<T>(
  path: string,
  { method = "GET", token, body }: RequestOptions,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  return readResponse<T>(response);
}

// Server-side only: returns the raw response so a file (e.g. the DPDP data export) can be streamed on.
export async function apiDownload(path: string, token: string): Promise<Response> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) {
    await readResponse<never>(response);
  }
  return response;
}

type UploadOptions = {
  token: string;
  body: FormData;
  timeoutMs: number;
};

// Called from the browser: files go straight to the API because Vercel functions cap request bodies at 4.5MB.
export async function apiUpload<T>(
  path: string,
  { token, body, timeoutMs }: UploadOptions,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
  return readResponse<T>(response);
}
