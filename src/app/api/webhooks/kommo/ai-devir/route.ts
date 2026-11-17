import { NextRequest, NextResponse } from "next/server";
import { anahtarDogruMu } from "@/lib/meta-capi";
import { aiDevirleriniIsle } from "@/lib/ai-devir";

export const dynamic = "force-dynamic";

/*
 * AI devir kontrolünü elle çalıştırır (normalde instrumentation.ts 5 dakikada bir çalıştırır).
 * POST /api/webhooks/kommo/ai-devir?anahtar=<KOMMO_WEBHOOK_SECRET>
 */
export async function POST(req: NextRequest) {
  if (!anahtarDogruMu(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const ozet = await aiDevirleriniIsle();
  return NextResponse.json({ ok: true, ...ozet });
}
