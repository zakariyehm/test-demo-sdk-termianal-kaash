import { getKaash } from "@/lib/kaash-server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const kaash = getKaash();
    const status = await kaash.getStatus();
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to get terminal status";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
