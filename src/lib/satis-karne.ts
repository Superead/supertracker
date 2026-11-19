/*
 * Satış karnesi: Kommo mesaj olaylarından satış grubu (Kommo hesabı) başına günlük ölçüler.
 *
 * Kommo'nun API'si mesaj metnini vermez ama her mesaj için bir olay verir:
 * incoming_chat_message (müşteri yazdı) ve outgoing_chat_message (created_by = gönderen kullanıcı,
 * 0 = bot / toplu mesaj / AI). Buradan her lead için "müşteri yazdı → satışçı cevapladı" bekleme
 * süreleri çıkar. Süreler mesai dakikasıyla ölçülür (09:00–21:00 TR); gece yazan müşterinin
 * süresi sabah 09:00'da başlar.
 *
 * Saatte bir (instrumentation) dün + bugün yeniden hesaplanır ve "şu an cevapsız bekleyen
 * müşteriler" listesi güncellenir. Geçmiş günler /api/satis-karne/guncelle ile doldurulur.
 */
import { prisma } from "./prisma";

const SUB = process.env.KOMMO_SUBDOMAIN || "mehmettashanligil";
const PIPELINE_ID = Number(process.env.KOMMO_PIPELINE_ID || "12058160");
const TR = 3 * 3600; // saniye
export const MESAI_BAS = 9 * 60; // dakika
export const MESAI_SON = 21 * 60;
/** Cevapsız sayılmak için gereken en az mesai dakikası. */
export const CEVAPSIZ_ESIK_DK = 30;
// Kazanıldı, kayıp, İSTEMİYOR ve AI geri kazanım aşamasındakiler cevapsız listesine girmez.
const KAPALI_ASAMALAR = [142, 143, 99442091, 114221320];
const SUPPORT_SOURCE_IDS = (process.env.KOMMO_SUPPORT_SOURCE_IDS || "165365,165447").split(",").map((s) => Number(s.trim()));

type Olay = { t: number; lead: number; yon: "in" | "out"; kim: number };
type Lead = { id: number; name: string; responsible_user_id: number; status_id: number; pipeline_id: number; created_at: number };
/** ilk = lead pencere içinde açıldı ve bu, müşterinin ilk mesajına verilen cevap (yeni lead'e ilk dönüş). */
export type Bekleme = { lead: number; grup: number; bas: number; bit: number | null; dk: number; ilk: boolean };
export type CevapsizMusteri = { leadId: number; leadAdi: string; kommoUserId: number; grup: string; bekleyenDk: number; yazdigi: string };

async function kommo(path: string) {
  const token = process.env.KOMMO_TOKEN;
  if (!token) throw new Error("KOMMO_TOKEN yok");
  for (let deneme = 0; deneme < 4; deneme++) {
    try {
      const r = await fetch(`https://${SUB}.kommo.com/api/v4${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (r.status === 204) return null;
      if (r.status === 429) throw new Error("429");
      if (!r.ok) throw new Error(`Kommo ${r.status}`);
      return await r.json();
    } catch (e) {
      if (deneme === 3) throw e;
      await new Promise((s) => setTimeout(s, 1500 * (deneme + 1)));
    }
  }
}

/** "YYYY-MM-DD" Türkiye günü → o günün 00:00'ının unix saniyesi. */
export function gunBasi(gun: string) {
  const [y, m, d] = gun.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 1000 - TR;
}
export function trGun(ts: number) {
  return new Date((ts + TR) * 1000).toISOString().slice(0, 10);
}
export function gunEkle(gun: string, n: number) {
  return trGun(gunBasi(gun) + n * 86400 + 3600);
}

/** İki an arasındaki mesai dakikası (her gün 09:00–21:00 TR). */
export function mesaiDk(bas: number, bit: number) {
  if (bit <= bas) return 0;
  let top = 0;
  let gun = trGun(bas);
  while (gunBasi(gun) < bit) {
    const g0 = gunBasi(gun);
    const a = Math.max(bas, g0 + MESAI_BAS * 60);
    const b = Math.min(bit, g0 + MESAI_SON * 60);
    if (b > a) top += (b - a) / 60;
    gun = gunEkle(gun, 1);
  }
  return Math.round(top);
}

async function olaylariGetir(bas: number, bit: number): Promise<Olay[]> {
  const out: Olay[] = [];
  for (let p = 1; p <= 500; p++) {
    const j = await kommo(
      `/events?filter[type]=incoming_chat_message,outgoing_chat_message&filter[created_at][from]=${bas}&filter[created_at][to]=${bit}&limit=100&page=${p}`,
    );
    const E = j?._embedded?.events || [];
    for (const e of E) {
      if (e.entity_type !== "lead") continue;
      out.push({ t: e.created_at, lead: e.entity_id, yon: e.type === "incoming_chat_message" ? "in" : "out", kim: e.created_by || 0 });
    }
    if (!j?._links?.next || E.length < 100) break;
  }
  return out;
}

async function leadleriGetir(ids: number[]): Promise<Map<number, Lead>> {
  const m = new Map<number, Lead>();
  for (let i = 0; i < ids.length; i += 200) {
    const q = ids.slice(i, i + 200).map((id, k) => `filter[id][${k}]=${id}`).join("&");
    const j = await kommo(`/leads?${q}&limit=250`);
    for (const l of j?._embedded?.leads || []) m.set(l.id, l);
  }
  return m;
}

async function acilanLeadler(bas: number, bit: number) {
  const out: { responsible_user_id: number; created_at: number }[] = [];
  for (let p = 1; p <= 100; p++) {
    const j = await kommo(`/leads?filter[pipeline_id]=${PIPELINE_ID}&filter[created_at][from]=${bas}&filter[created_at][to]=${bit}&limit=250&page=${p}&with=source_id`);
    const L = j?._embedded?.leads || [];
    for (const l of L) if (!SUPPORT_SOURCE_IDS.includes(Number(l.source_id))) out.push(l);
    if (L.length < 250) break;
  }
  return out;
}

/** Satış grupları: SuperTracker'da en az bir kullanıcının bağlı olduğu aktif Kommo hesapları. */
export async function satisGruplari(): Promise<Map<number, string>> {
  const bagli = await prisma.user.findMany({ where: { kommoUserId: { not: null }, isActive: true }, select: { kommoUserId: true } });
  const ids = new Set(bagli.map((u) => u.kommoUserId as number));
  const haric = (process.env.KOMMO_EXCLUDED_IDS || "13905092,15728328").split(",").map((s) => Number(s.trim()));
  const j = await kommo("/users?limit=250");
  const m = new Map<number, string>();
  for (const u of j?._embedded?.users || []) {
    if (ids.has(u.id) && !haric.includes(u.id) && u.rights?.is_active !== false) m.set(u.id, u.name);
  }
  return m;
}

/** Lead başına zaman çizelgesinden bekleme–cevap çiftleri. Bot mesajı cevap sayılmaz. */
export function beklemeler(olaylar: Olay[], leadler: Map<number, Lead>, simdi: number, pencereBasi: number): Bekleme[] {
  const leadBazli = new Map<number, Olay[]>();
  for (const o of olaylar) (leadBazli.get(o.lead) ?? leadBazli.set(o.lead, []).get(o.lead)!).push(o);
  const out: Bekleme[] = [];
  for (const [lead, liste] of leadBazli) {
    const l = leadler.get(lead);
    if (!l) continue;
    liste.sort((a, b) => a.t - b.t);
    // Lead penceredeyken açıldıysa ve ondan önce satışçı yazmadıysa ilk bekleme "ilk cevap" sayılır.
    let ilk = l.created_at >= pencereBasi;
    let bekliyor: number | null = null;
    for (const o of liste) {
      if (o.yon === "in") {
        if (bekliyor === null) bekliyor = o.t;
      } else if (o.kim > 0) {
        if (bekliyor !== null) {
          out.push({ lead, grup: l.responsible_user_id, bas: bekliyor, bit: o.t, dk: mesaiDk(bekliyor, o.t), ilk });
          bekliyor = null;
        }
        ilk = false;
      }
    }
    if (bekliyor !== null) out.push({ lead, grup: l.responsible_user_id, bas: bekliyor, bit: null, dk: mesaiDk(bekliyor, simdi), ilk });
  }
  return out;
}

/**
 * Verilen günleri yeniden hesaplar. Olaylar ilk günün 00:00'ından (bir sonraki günün sonuna ya da şimdiye
 * kadar) çekilir, böylece gece yarısını geçen cevaplar da yakalanır.
 * cevapsizListesi=true ise "şu an cevapsız" anlık listesi de yazılır.
 */
export async function gunleriHesapla(gunler: string[], opts: { cevapsizListesi?: boolean } = {}) {
  const simdi = Math.floor(Date.now() / 1000);
  const sirali = [...gunler].sort();
  const bas = gunBasi(sirali[0]);
  const bit = Math.min(simdi, gunBasi(sirali[sirali.length - 1]) + 2 * 86400);

  const gruplar = await satisGruplari();
  const olaylar = await olaylariGetir(bas, bit);
  const leadler = await leadleriGetir([...new Set(olaylar.map((o) => o.lead))]);
  const B = beklemeler(olaylar, leadler, simdi, bas);

  for (const gun of sirali) {
    const g0 = gunBasi(gun);
    const g1 = g0 + 86400;
    const acilan = await acilanLeadler(g0, Math.min(g1 - 1, simdi));
    for (const [kid, ad] of gruplar) {
      const benim = B.filter((b) => b.grup === kid && b.bas >= g0 && b.bas < g1);
      const sureler = benim.filter((b) => b.bit !== null).map((b) => b.dk).sort((a, b) => a - b);
      // Cevaplanmamış ilk mesajlar da ilk cevap ölçüsüne şimdiye kadarki bekleme süresiyle girer.
      const ilkSureler = benim.filter((b) => b.ilk).map((b) => b.dk).sort((a, b) => a - b);
      const yazan = new Set(
        olaylar.filter((o) => o.yon === "in" && o.t >= g0 && o.t < g1 && leadler.get(o.lead)?.responsible_user_id === kid).map((o) => o.lead),
      );
      const veri = {
        kommoAd: ad,
        leadSayisi: acilan.filter((l) => l.responsible_user_id === kid).length,
        yazanMusteri: yazan.size,
        satisciMesaj: olaylar.filter((o) => o.yon === "out" && o.kim === kid && o.t >= g0 && o.t < g1).length,
        cevapSureleri: JSON.stringify(sureler),
        ilkCevapSureleri: JSON.stringify(ilkSureler),
        cevapsiz: benim.filter((b) => b.bit === null && b.dk >= CEVAPSIZ_ESIK_DK).length,
      };
      await prisma.satisGunluk.upsert({ where: { gun_kommoUserId: { gun, kommoUserId: kid } }, create: { gun, kommoUserId: kid, ...veri }, update: veri });
    }
  }

  if (opts.cevapsizListesi) {
    const liste: CevapsizMusteri[] = B.filter((b) => {
      const l = leadler.get(b.lead);
      return b.bit === null && b.dk >= CEVAPSIZ_ESIK_DK && gruplar.has(b.grup) && l && l.pipeline_id === PIPELINE_ID && !KAPALI_ASAMALAR.includes(l.status_id);
    })
      .sort((a, b) => b.dk - a.dk)
      .map((b) => ({
        leadId: b.lead,
        leadAdi: leadler.get(b.lead)?.name || `Lead #${b.lead}`,
        kommoUserId: b.grup,
        grup: gruplar.get(b.grup) || String(b.grup),
        bekleyenDk: b.dk,
        yazdigi: new Date(b.bas * 1000).toISOString(),
      }));
    await prisma.satisDurum.upsert({ where: { anahtar: "cevapsiz" }, create: { anahtar: "cevapsiz", veri: JSON.stringify(liste) }, update: { veri: JSON.stringify(liste) } });
    const ozet = JSON.stringify({ gunler: sirali, olay: olaylar.length, bekleme: B.length });
    await prisma.satisDurum.upsert({ where: { anahtar: "son-guncelleme" }, create: { anahtar: "son-guncelleme", veri: ozet }, update: { veri: ozet } });
  }
  return { gunler: sirali, olay: olaylar.length, bekleme: B.length };
}

let sonCalisma = 0;
/** instrumentation her 5 dakikada çağırır; saatte bir dün + bugün hesaplanır. */
export async function satisKarnesiniGuncelle() {
  if (Date.now() - sonCalisma < 55 * 60_000) return {};
  sonCalisma = Date.now();
  const bugun = trGun(Math.floor(Date.now() / 1000));
  const sonuc = await gunleriHesapla([gunEkle(bugun, -1), bugun], { cevapsizListesi: true });
  return { islenen: [sonuc] };
}

let doldurmaSuruyor = false;
/** Geçmiş günleri tek tek doldurur (bugünden geriye). Arka planda çalışır. */
export async function gecmisiDoldur(gunSayisi: number) {
  if (doldurmaSuruyor) return false;
  doldurmaSuruyor = true;
  try {
    const bugun = trGun(Math.floor(Date.now() / 1000));
    for (let i = 2; i <= gunSayisi; i++) {
      try {
        await gunleriHesapla([gunEkle(bugun, -i)]);
      } catch (e) {
        console.error("[satis-karne] doldurma hatası", gunEkle(bugun, -i), e instanceof Error ? e.message : e);
      }
    }
  } finally {
    doldurmaSuruyor = false;
  }
  return true;
}

export function medyan(a: number[]) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}
