import { NextRequest, after } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { karneAnahtariDogruMu } from "@/lib/karne-yetki";
import { gecmisiDoldur, gunleriHesapla, gunEkle, trGun } from "@/lib/satis-karne";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/*
 * POST            → dün + bugün hemen yeniden hesaplanır, cevapsız listesi yenilenir (admin ya da anahtar).
 * POST ?gecmis=30 → ayrıca son 30 gün arka planda doldurulur (birkaç dakika sürer).
 */
export async function POST(request: NextRequest) {
  const u = await getCurrentUser();
  if (u?.role !== "admin" && !karneAnahtariDogruMu(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const bugun = trGun(Math.floor(Date.now() / 1000));
  const sonuc = await gunleriHesapla([gunEkle(bugun, -1), bugun], { cevapsizListesi: true });
  const gecmis = Math.min(90, Number(request.nextUrl.searchParams.get("gecmis")) || 0);
  if (gecmis > 2) after(() => gecmisiDoldur(gecmis));
  return Response.json({ ...sonuc, gecmisDolduruluyor: gecmis > 2 ? gecmis : 0 });
}
