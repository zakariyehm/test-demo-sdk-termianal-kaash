import { Kaash } from "@kaash/terminal-sdk";

let kaashInstance: Kaash | null = null;

export function getKaash(): Kaash {
  if (!kaashInstance) {
    const apiKey = process.env.KAASH_API_KEY;
    if (!apiKey) {
      throw new Error(
        "KAASH_API_KEY is missing. Add it to .env.local (from Kaash Super Admin).",
      );
    }

    kaashInstance = Kaash.createForDesktop({
      apiKey,
      apiUrl: process.env.KAASH_API_URL,
      debug: process.env.NODE_ENV === "development",
    });
  }

  return kaashInstance;
}
