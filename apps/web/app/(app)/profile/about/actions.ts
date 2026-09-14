"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { validateAbout } from "@/lib/about";
import { ApiError, apiRequest } from "@/lib/api";
import { formText } from "@/lib/form-data";
import { isAppRole } from "@/lib/roles";

import type { SaveAboutState } from "@/lib/about";
import type { AboutResponse } from "@/lib/api-types";

export async function saveAbout(
  _previous: SaveAboutState,
  formData: FormData,
): Promise<SaveAboutState> {
  const role = formText(formData, "role");
  if (!isAppRole(role)) {
    return { fieldErrors: {}, formError: "Something went wrong. Refresh the page and try again." };
  }

  const result = validateAbout(role, formText(formData, "bio"), formText(formData, "website"));
  if (result.errors) {
    return { fieldErrors: result.errors, formError: null };
  }

  const { getToken } = await auth();
  const token = await getToken();
  if (!token) {
    redirect("/sign-in");
  }

  try {
    await apiRequest<AboutResponse>("/v1/profiles/about", {
      method: "POST",
      token,
      body: result.data,
    });
  } catch (error) {
    console.error("Saving profile bio failed", error);
    return {
      fieldErrors: {},
      formError:
        error instanceof ApiError && error.status === 422
          ? "Some details didn’t pass our checks. Review them and try again."
          : "We couldn’t save your changes. Please try again in a moment.",
    };
  }

  redirect("/profile");
}
