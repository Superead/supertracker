import { NextRequest, NextResponse } from "next/server";
import { anahtarDogruMu } from "@/lib/meta-capi";
import { dersHatirlatmalariniGonder } from "@/lib/ders-hatirlatma";

export const dynamic = "force-dynamic";

/*
 * Ders hatırlatmalarını elle çalıştırır (normalde instrumentation.ts 5 dakikada bir çalıştırır).
 * POST /api/webhooks/kommo/ders-hatirlatma?anahtar=<KOMMO_WEBHOOK_SECRET>[&dry=1]
 * dry=1: hiçbir şey göndermez, bugün kime gideceğini listeler.
 */
export async function POST(req: NextRequest) {
  if (!anahtarDogruMu(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const ozet = await dersHatirlatmalariniGonder({ dry });
  return NextResponse.json({ ok: true, dry, ...ozet });
}
