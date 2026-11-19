import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { karneYetkisi } from "@/lib/karne-yetki";
import { gunBasi, gunEkle, trGun, medyan } from "@/lib/satis-karne";

export const dynamic = "force-dynamic";

/*
 * GET ?gun=1|7|30  → satış karnesi: KPI'lar, grup tablosu (önceki dönemle kıyas), günlük seriler,
 * cevapsız bekleyen müşteriler, son kalite raporu, koçluk görevleri. Admin ve satış müdürü.
 */
export async function GET(request: NextRequest) {
  if (!(await karneYetkisi())) return Response.json({ error: "Forbidden" }, { status: 403 });
  const n = Math.min(90, Math.max(1, Number(request.nextUrl.searchParams.get("gun")) || 7));
  const bugun = trGun(Math.floor(Date.now() / 1000));
  const bas = gunEkle(bugun, -(n - 1));
  const oncekiBas = gunEkle(bas, -n);
  const gunler = Array.from({ length: n }, (_, i) => gunEkle(bas, i));

  const [satirlar, kullanicilar, satislar, cevapsiz, sonGuncelleme, kocluk, haftalar, dokunulmamis] = await Promise.all([
    prisma.satisGunluk.findMany({ where: { gun: { gte: oncekiBas, lte: bugun } } }),
    prisma.user.findMany({ where: { kommoUserId: { not: null } }, select: { id: true, name: true, kommoUserId: true, isActive: true } }),
    prisma.sale.findMany({
      where: { isDeleted: false, createdAt: { gte: new Date(gunBasi(oncekiBas) * 1000) } },
      select: { userId: true, totalPrice: true, createdAt: true, packageType: true },
    }),
    prisma.satisDurum.findUnique({ where: { anahtar: "cevapsiz" } }),
    prisma.satisDurum.findUnique({ where: { anahtar: "son-guncelleme" } }),
    prisma.koclukNotu.findMany({ orderBy: [{ durum: "asc" }, { createdAt: "desc" }], take: 200 }),
    prisma.kaliteRaporu.findMany({ select: { hafta: true }, distinct: ["hafta"], orderBy: { hafta: "desc" }, take: 12 }),
    prisma.satisDurum.findUnique({ where: { anahtar: "dokunulmamis" } }),
  ]);
  // Eğitici satışı: eğitici eğitimi paketleri; kalan (bireysel, birebir) bireysel sayılır.
  const egiticiSatis = (p: string) => p === "instructor" || p === "educator";
  const yuzde = (a: number[], esik: number) => (a.length ? Math.round((100 * a.filter((x) => x <= esik).length) / a.length) : null);

  const hafta = request.nextUrl.searchParams.get("hafta") || haftalar[0]?.hafta || null;
  const kalite = hafta ? await prisma.kaliteRaporu.findMany({ where: { hafta } }) : [];

  // Gruplar: günlük satırlarda görünen Kommo hesapları (son adı) + SuperTracker'da bağlı olanlar.
  const ad = new Map<number, string>();
  for (const s of [...satirlar].sort((a, b) => a.gun.localeCompare(b.gun))) ad.set(s.kommoUserId, s.kommoAd);
  const uyeler = new Map<number, { id: string; name: string }[]>();
  for (const u of kullanicilar) {
    if (!u.kommoUserId) continue;
    (uyeler.get(u.kommoUserId) ?? uyeler.set(u.kommoUserId, []).get(u.kommoUserId)!).push({ id: u.id, name: u.name });
  }
  const kullaniciGrubu = new Map(kullanicilar.map((u) => [u.id, u.kommoUserId as number]));

  const donem = (kid: number, g0: string, g1: string) => {
    const r = satirlar.filter((s) => s.kommoUserId === kid && s.gun >= g0 && s.gun <= g1);
    const sureler = r.flatMap((s) => JSON.parse(s.cevapSureleri) as number[]);
    const ilk = r.flatMap((s) => JSON.parse(s.ilkCevapSureleri) as number[]);
    const sat = satislar.filter((s) => kullaniciGrubu.get(s.userId) === kid && trGun(s.createdAt.getTime() / 1000) >= g0 && trGun(s.createdAt.getTime() / 1000) <= g1);
    const lead = r.reduce((t, s) => t + s.leadSayisi, 0);
    const ciro = sat.reduce((t, s) => t + s.totalPrice, 0);
    const tipOzet = (egitici: boolean) => {
      const l = r.reduce((t, s) => t + (egitici ? s.egiticiLead : s.bireyselLead), 0);
      const st = sat.filter((s) => egiticiSatis(s.packageType) === egitici);
      const ic = r.flatMap((s) => JSON.parse(egitici ? s.egiticiIlkCevap : s.bireyselIlkCevap) as number[]);
      return {
        lead: l,
        satis: st.length,
        ciro: st.reduce((t, s) => t + s.totalPrice, 0),
        donusum: l ? Math.round((st.length / l) * 1000) / 10 : null,
        ilkCevapMedyan: medyan(ic),
        cevap10: yuzde(ic, 10),
      };
    };
    return {
      lead,
      satis: sat.length,
      ciro,
      donusum: lead ? Math.round((sat.length / lead) * 1000) / 10 : null,
      sepet: sat.length ? Math.round(ciro / sat.length) : null,
      ilkCevapMedyan: medyan(ilk),
      cevap10: ilk.length ? Math.round((100 * ilk.filter((x) => x <= 10).length) / ilk.length) : null,
      cevap60: ilk.length ? Math.round((100 * ilk.filter((x) => x <= 60).length) / ilk.length) : null,
      ilkCevapSayisi: ilk.length,
      cevapMedyan: medyan(sureler),
      cevapSayisi: sureler.length,
      yazanMusteri: r.reduce((t, s) => t + s.yazanMusteri, 0),
      satisciMesaj: r.reduce((t, s) => t + s.satisciMesaj, 0),
      cevapsizBirakilan: r.reduce((t, s) => t + s.cevapsiz, 0),
      dokunulmamis: r.reduce((t, s) => t + s.dokunulmamis, 0),
      bireysel: tipOzet(false),
      egitici: tipOzet(true),
      _sureler: ilk,
    };
  };

  const kalitePuani = new Map(
    kalite.filter((k) => k.kommoUserId).map((k) => {
      const v = JSON.parse(k.veri);
      const p = v.puanlar || {};
      const toplam = Object.values(p).reduce((t: number, x) => t + Number(x || 0), 0);
      return [k.kommoUserId, toplam as number];
    }),
  );

  const cevapsizListe: { kommoUserId: number }[] = cevapsiz ? JSON.parse(cevapsiz.veri) : [];
  const dokunulmamisListe: { kommoUserId: number; tip: string }[] = dokunulmamis ? JSON.parse(dokunulmamis.veri) : [];
  const gruplar = [...new Set([...ad.keys(), ...uyeler.keys()])]
    .filter((kid) => ad.has(kid))
    .map((kid) => {
      const simdi = donem(kid, bas, bugun);
      const once = donem(kid, oncekiBas, gunEkle(bas, -1));
      const seri = gunler.map((g) => {
        const d = donem(kid, g, g);
        return { gun: g, satis: d.satis, ilkCevap: d.ilkCevapMedyan };
      });
      const { _sureler, ...ozet } = simdi;
      void _sureler;
      const { _sureler: _o, ...onceOzet } = once;
      void _o;
      return {
        kommoUserId: kid,
        grup: ad.get(kid)!,
        uyeler: uyeler.get(kid) || [],
        ...ozet,
        once: onceOzet,
        seri,
        simdiCevapsiz: cevapsizListe.filter((c) => c.kommoUserId === kid).length,
        simdiDokunulmamis: dokunulmamisListe.filter((c) => c.kommoUserId === kid).length,
        kalitePuani: kalitePuani.get(kid) ?? null,
        acikKocluk: kocluk.filter((k) => k.kommoUserId === kid && k.durum === "acik").length,
      };
    })
    .sort((a, b) => b.ciro - a.ciro || b.satis - a.satis);

  // Toplamlar
  const tumSureler = satirlar.filter((s) => s.gun >= bas && ad.has(s.kommoUserId)).flatMap((s) => JSON.parse(s.ilkCevapSureleri) as number[]);
  const topla = (k: "lead" | "satis" | "ciro") => gruplar.reduce((t, g) => t + g[k], 0);
  const toplaOnce = (k: "lead" | "satis" | "ciro") => gruplar.reduce((t, g) => t + g.once[k], 0);
  const ozet = {
    satis: topla("satis"),
    ciro: topla("ciro"),
    lead: topla("lead"),
    donusum: topla("lead") ? Math.round((topla("satis") / topla("lead")) * 1000) / 10 : null,
    ilkCevapMedyan: medyan(tumSureler),
    cevap10: tumSureler.length ? Math.round((100 * tumSureler.filter((x) => x <= 10).length) / tumSureler.length) : null,
    simdiCevapsiz: cevapsizListe.length,
    simdiDokunulmamis: dokunulmamisListe.length,
    tip: (["bireysel", "egitici"] as const).map((t) => {
      const ic = satirlar
        .filter((s) => s.gun >= bas && ad.has(s.kommoUserId))
        .flatMap((s) => JSON.parse(t === "egitici" ? s.egiticiIlkCevap : s.bireyselIlkCevap) as number[]);
      const lead = gruplar.reduce((x, g) => x + g[t].lead, 0);
      const satis = gruplar.reduce((x, g) => x + g[t].satis, 0);
      return {
        tip: t,
        lead,
        satis,
        ciro: gruplar.reduce((x, g) => x + g[t].ciro, 0),
        donusum: lead ? Math.round((satis / lead) * 1000) / 10 : null,
        ilkCevapMedyan: medyan(ic),
        cevap10: yuzde(ic, 10),
        dokunulmamis: dokunulmamisListe.filter((d) => d.tip === t).length,
      };
    }),
    once: { satis: toplaOnce("satis"), ciro: toplaOnce("ciro"), lead: toplaOnce("lead") },
  };

  return Response.json({
    donem: { bas, bit: bugun, gun: n },
    ozet,
    gruplar,
    cevapsiz: cevapsizListe,
    cevapsizGuncelleme: cevapsiz?.updatedAt || null,
    dokunulmamis: dokunulmamisListe,
    sonGuncelleme: sonGuncelleme?.updatedAt || null,
    veriBaslangici: satirlar.length ? satirlar.reduce((m, s) => (s.gun < m ? s.gun : m), "9999") : null,
    kalite: { hafta, haftalar: haftalar.map((h) => h.hafta), raporlar: kalite.map((k) => ({ kommoUserId: k.kommoUserId, grup: k.grup, ...JSON.parse(k.veri) })) },
    kocluk,
  });
}
