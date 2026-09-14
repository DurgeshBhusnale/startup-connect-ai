import type { AboutRequest, AppRole } from "@/lib/api-types";

export const BIO_MAX = 280;

const WEBSITE = /^(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?$/i;

export type AboutField = "bio" | "website";
export type AboutFieldErrors = Partial<Record<AboutField, string>>;

export type SaveAboutState = {
  fieldErrors: AboutFieldErrors;
  formError: string | null;
};

export const initialSaveAboutState: SaveAboutState = { fieldErrors: {}, formError: null };

type AboutValidation =
  | { data: AboutRequest; errors: null }
  | { data: null; errors: AboutFieldErrors };

export function validateAbout(role: AppRole, bio: string, website: string): AboutValidation {
  const errors: AboutFieldErrors = {};

  const trimmedBio = bio.trim();
  if (trimmedBio.length > BIO_MAX) errors.bio = `Keep your bio under ${BIO_MAX} characters.`;

  const trimmedWebsite = role === "founder" ? website.trim() : "";
  if (trimmedWebsite && (trimmedWebsite.length > 200 || !WEBSITE.test(trimmedWebsite))) {
    errors.website = "Enter a website like https://rupeez.in.";
  }

  if (Object.keys(errors).length > 0) {
    return { data: null, errors };
  }
  return {
    data: { kind: role, bio: trimmedBio || null, website: trimmedWebsite || null },
    errors: null,
  };
}
