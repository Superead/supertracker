import { prisma } from "@/lib/prisma";

/*
 * Birebir ders günü sabahı veliye WhatsApp hatırlatması (Kommo üzerinden, 0533 destek hattı).
 *
 * Her çalışmada (instrumentation.ts, 5 dakikada bir): Türkiye saatiyle 09:00'dan sonra, bugünkü
 * planlanmış ve henüz hatırlatılmamış dersler için:
 *   1. veli telefonunu Kommo'da kişiyle eşleştirir (yoksa kişi açar),
 *   2. öğrencinin DesteK hattındaki "Birebir: …" lead'ini bulur ya da açar,
 *   3. lead'e Ders saati / Öğrenci adı / Ders linki alanlarını yazar,
 *   4. "Ders Hatırlatma" salesbot'unu başlatır; bot onaylı ders_hatirlatma şablonunu gönderir.
 * DERS_HATIRLATMA_BOT_ID tanımlı değilse hiçbir şey göndermez.
 */

const KOMMO_TOKEN = process.env.KOMMO_TOKEN;
const KOMMO_SUBDOMAIN = process.env.KOMMO_SUBDOMAIN || "mehmettashanligil";
const BOT_ID = parseInt(process.env.DERS_HATIRLATMA_BOT_ID || "0");
const PIPELINE_ID = parseInt(process.env.BIREBIR_KOMMO_PIPELINE_ID || "14317580"); // DesteK
const STATUS_ID = parseInt(process.env.BIREBIR_KOMMO_STATUS_ID || "110577132"); // Service booked
const CF_SAAT = 3043910;
const CF_OGRENCI = 3043912;
const CF_LINK = 3043914;
const GONDERIM_SAATI = "09:00";
const MAX_DENEME = 3;

export async function kommo<T>(method: string, path: string, body?: unknown, base = "/api/v4", retried = false): Promise<T | null> {
  if (!KOMMO_TOKEN) throw new Error("KOMMO_TOKEN not configured");
  const res = await fetch(`https://${KOMMO_SUBDOMAIN}.kommo.com${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${KOMMO_TOKEN}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (res.status === 204) return null;
  if (res.status === 429 && !retried) {
    await new Promise((r) => setTimeout(r, 1500));
    return kommo<T>(method, path, body, base, true);
  }
  if (!res.ok) throw new Error(`Kommo ${method} ${path.split("?")[0]}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Türkiye cep numarasını 90XXXXXXXXXX biçimine getirir; tanınmazsa null. */
export function trTelefon(raw: string | null | undefined): string | null {
  const d = (raw || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("90")) return d;
  if (d.length === 11 && d.startsWith("0")) return "9" + d;
  if (d.length === 10 && d.startsWith("5")) return "90" + d;
  return null;
}

function simdiTR() {
  const iso = new Date(Date.now() + 3 * 3600000).toISOString();
  return { tarih: iso.slice(0, 10), saat: iso.slice(11, 16) };
}

type Kisi = { id: number; custom_fields_values?: { field_code?: string; values: { value: string }[] }[] | null };

export async function kisiBulVeyaAc(tel: string, ad: string): Promise<number> {
  const son10 = tel.slice(-10);
  const sonuc = await kommo<{ _embedded: { contacts: Kisi[] } }>("GET", `/contacts?query=${son10}&limit=50`);
  for (const k of sonuc?._embedded.contacts ?? []) {
    const telefonlar = (k.custom_fields_values || [])
      .filter((f) => f.field_code === "PHONE")
      .flatMap((f) => f.values.map((v) => (v.value || "").replace(/\D/g, "")));
    if (telefonlar.some((t) => t.endsWith(son10))) return k.id;
  }
  const yeni = await kommo<{ _embedded: { contacts: { id: number }[] } }>("POST", "/contacts", [
    { name: ad, custom_fields_values: [{ field_code: "PHONE", values: [{ value: `+${tel}`, enum_code: "MOB" }] }] },
  ]);
  return yeni!._embedded.contacts[0].id;
}

async function leadBulVeyaAc(student: { id: string; studentName: string; kommoLeadId: number | null }, kisiId: number) {
  if (student.kommoLeadId) {
    const l = await kommo<{ id: number; is_deleted?: boolean }>("GET", `/leads/${student.kommoLeadId}`).catch(() => null);
    if (l?.id) return l.id;
  }
  const yeni = await kommo<{ _embedded: { leads: { id: number }[] } }>("POST", "/leads", [
    {
      name: `Birebir: ${student.studentName}`,
      pipeline_id: PIPELINE_ID,
      status_id: STATUS_ID,
      _embedded: { contacts: [{ id: kisiId }], tags: [{ name: "birebir" }] },
    },
  ]);
  const leadId = yeni!._embedded.leads[0].id;
  await prisma.student.update({ where: { id: student.id }, data: { kommoLeadId: leadId } });
  return leadId;
}

export type HatirlatmaOzeti = { aktif: boolean; bugun: number; gonderilen: string[]; hatalar: string[]; atlanan: string[] };

export async function dersHatirlatmalariniGonder(opts: { dry?: boolean } = {}): Promise<HatirlatmaOzeti> {
  const ozet: HatirlatmaOzeti = { aktif: !!BOT_ID, bugun: 0, gonderilen: [], hatalar: [], atlanan: [] };
  const { tarih, saat } = simdiTR();
  if (saat < GONDERIM_SAATI) return ozet;

  const dersler = await prisma.plannedLesson.findMany({
    where: { date: tarih, status: "scheduled", reminderSentAt: null, reminderAttempts: { lt: MAX_DENEME } },
    include: { student: { select: { id: true, studentName: true, parentName: true, parentPhone: true, kommoLeadId: true, isActive: true } } },
    orderBy: { time: "asc" },
  });
  ozet.bugun = dersler.length;

  for (const ders of dersler) {
    const etiket = `${ders.student.studentName} ${ders.time}`;
    if (!ders.student.isActive) { ozet.atlanan.push(`${etiket}: öğrenci pasif`); continue; }
    if (ders.time <= saat) { ozet.atlanan.push(`${etiket}: ders saati geçmiş`); continue; }
    const tel = trTelefon(ders.student.parentPhone);
    if (!tel) {
      ozet.hatalar.push(`${etiket}: veli telefonu yok veya geçersiz`);
      if (!opts.dry) {
        await prisma.plannedLesson.update({
          where: { id: ders.id },
          data: { reminderError: "Veli telefonu yok veya geçersiz", reminderAttempts: MAX_DENEME },
        });
      }
      continue;
    }
    if (opts.dry || !BOT_ID) { ozet.atlanan.push(`${etiket}: ${opts.dry ? "deneme" : "bot tanımlı değil"} (+${tel})`); continue; }

    try {
      const kisiId = await kisiBulVeyaAc(tel, ders.student.parentName || ders.student.studentName);
      const leadId = await leadBulVeyaAc(ders.student, kisiId);
      await kommo("PATCH", `/leads/${leadId}`, {
        custom_fields_values: [
          { field_id: CF_SAAT, values: [{ value: ders.time }] },
          { field_id: CF_OGRENCI, values: [{ value: ders.student.studentName }] },
          { field_id: CF_LINK, values: [{ value: ders.meetLink || "Eğitmeniniz bağlantıyı ayrıca iletecek." }] },
        ],
      });
      await kommo("POST", "/salesbot/run", [{ bot_id: BOT_ID, entity_id: leadId, entity_type: 2 }], "/api/v2");
      await prisma.plannedLesson.update({
        where: { id: ders.id },
        data: { reminderSentAt: new Date(), reminderError: null, reminderAttempts: { increment: 1 } },
      });
      ozet.gonderilen.push(`${etiket} → lead ${leadId}`);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      ozet.hatalar.push(`${etiket}: ${m}`);
      await prisma.plannedLesson.update({
        where: { id: ders.id },
        data: { reminderError: m.slice(0, 300), reminderAttempts: { increment: 1 } },
      });
    }
  }
  return ozet;
}
