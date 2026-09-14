import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { ApiError, apiDownload, apiRequest } from "@/lib/api";

import type { DataExportResponse } from "@/lib/api-types";

const EXPORT_PATH_PREFIX = "/v1/me/data-export/";

// PRD M10 AC4: without email delivery in v1, the export downloads straight to the browser.
export async function GET(request: Request): Promise<Response> {
  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const created = await apiRequest<DataExportResponse>("/v1/me/data-export", {
      method: "POST",
      token,
    });
    if (!created.download_path.startsWith(EXPORT_PATH_PREFIX)) {
      throw new Error("Unexpected export download path");
    }
    const file = await apiDownload(created.download_path, token);
    return new Response(file.body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition":
          file.headers.get("Content-Disposition") ??
          'attachment; filename="startup-connect-data.json"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Data export failed", error);
    const status = error instanceof ApiError && error.status === 429 ? "export-limit" : "export-failed";
    return NextResponse.redirect(new URL(`/settings/privacy?export=${status}`, request.url), 303);
  }
}
