import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { karneAnahtariDogruMu, karneYetkisi } from "@/lib/karne-yetki";

export const dynamic = "force-dynamic";

/*
 * Haftalık yazışma kalitesi raporu (zamanlanmış görev gönderir; anahtar KARNE_ANAHTAR ya da admin oturumu).
 * POST {
 *   hafta: "YYYY-MM-DD" (pazartesi),
 *   genel?: { ozet, oneriler: string[], ortakSorunlar: string[] },
 *   gruplar: [{ kommoUserId, grup, puanlar: { hiz, ihtiyac, deger, fiyat, itiraz, kapanis, uslup } (1–5),
 *              ozet, guclu: string[], zayif: string[], iyiOrnekler: [{ leadId, metin }],
 *              zayifOrnekler: [{ leadId, aciklama }], ihlaller: [{ leadId, ifade, kural }],
 *              orneklem: { kazanilan, kaybedilen } }]
 * }
 * Aynı hafta yeniden gönderilirse üzerine yazılır.
 */
const KRITERLER = ["hiz", "ihtiyac", "deger", "fiyat", "itiraz", "kapanis", "uslup"];

export async function POST(request: NextRequest) {
  if (!karneAnahtariDogruMu(request)) {
    const u = await karneYetkisi();
    if (u?.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const b = await request.json();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.hafta || ""))) return Response.json({ error: "hafta YYYY-MM-DD olmalı" }, { status: 400 });
  if (!Array.isArray(b.gruplar) || !b.gruplar.length) return Response.json({ error: "gruplar boş" }, { status: 400 });

  const kayitlar: { kommoUserId: number; grup: string; veri: string }[] = [];
  for (const g of b.gruplar) {
    const kid = Number(g.kommoUserId);
    if (!kid || !g.grup) return Response.json({ error: "her grupta kommoUserId ve grup gerekli" }, { status: 400 });
    const puanlar: Record<string, number> = {};
    for (const k of KRITERLER) {
      const p = Number(g.puanlar?.[k]);
      if (!(p >= 1 && p <= 5)) return Response.json({ error: `${g.grup}: ${k} puanı 1–5 olmalı` }, { status: 400 });
      puanlar[k] = p;
    }
    kayitlar.push({ kommoUserId: kid, grup: String(g.grup), veri: JSON.stringify({ ...g, puanlar }) });
  }
  if (b.genel) kayitlar.push({ kommoUserId: 0, grup: "GENEL", veri: JSON.stringify(b.genel) });

  await prisma.$transaction(
    kayitlar.map((k) =>
      prisma.kaliteRaporu.upsert({
        where: { hafta_kommoUserId: { hafta: b.hafta, kommoUserId: k.kommoUserId } },
        create: { hafta: b.hafta, ...k },
        update: { grup: k.grup, veri: k.veri, createdAt: new Date() },
      }),
    ),
  );
  return Response.json({ ok: true, hafta: b.hafta, grup: kayitlar.length }, { status: 201 });
}
