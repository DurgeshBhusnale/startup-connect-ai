// Mirrors `AskPinRequest` in apps/api/app/models/ask_pin.py.
export const ASK_PIN_MAX = 140;

/** One line, trimmed: pasted line breaks and repeated spaces collapse to a single space. */
export function normalizeAskPin(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
