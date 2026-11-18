import { prisma } from "@/lib/prisma";
import { getBusyIntervals } from "@/lib/google";
import { getCurrentUser } from "@/lib/auth";
import { kommo, kisiBulVeyaAc } from "@/lib/ders-hatirlatma";

/*
 * Gelişim randevuları (app öğrencileri, 15 dk görüşme, arka arkaya verilebilir). Birebir derslerden ayrıdır.
 * Randevuyu destek ekibi verir; sistem hocaların Google takvimlerinden boş saatleri çıkarır,
 * hocanın takvimine Meet linkli etkinlik açar, 0533'ten WhatsApp onayı ve sabah hatırlatması gönderir.
 */

export const SURE_DK = 15;
const GUN_BASI = 9 * 60; // 09:00
const GUN_SONU = 23 * 60; // 23:00

const ONAY_BOT_ID = parseInt(process.env.RANDEVU_ONAY_BOT_ID || "0");
const HATIRLATMA_BOT_ID = parseInt(process.env.RANDEVU_HATIRLATMA_BOT_ID || "0");
const PIPELINE_ID = parseInt(process.env.BIREBIR_KOMMO_PIPELINE_ID || "14317580"); // DesteK
const STATUS_ID = parseInt(process.env.BIREBIR_KOMMO_STATUS_ID || "110577132");
const CF_EGITMEN = 3043916;
const CF_ZAMAN = 3043918;
const CF_LINK = 3043920;
const MAX_DENEME = 3;

const GUNLER = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

/** Randevu sayfasını kimler kullanabilir: admin, destek, iç (kurum) eğitmenleri. */
export async function randevuYetkisi() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role === "admin" || user.role === "support") return user;
  const egitmen = await prisma.educator.findUnique({ where: { userId: user.id }, select: { isInternal: true } });
  return egitmen?.isInternal ? user : null;
}

export const dk = (hhmm: string) => parseInt(hhmm.slice(0, 2)) * 60 + parseInt(hhmm.slice(3, 5));
export const saat = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function simdiTR() {
  const iso = new Date(Date.now() + 3 * 3600000).toISOString();
  return { tarih: iso.slice(0, 10), saat: iso.slice(11, 16) };
}

/** "18 Kasım Çarşamba 15:15" */
export function trZaman(date: string, time: string) {
  const [y, m, g] = date.split("-").map(Number);
  const gun = GUNLER[new Date(Date.UTC(y, m - 1, g)).getUTCDay()];
  return `${g} ${AYLAR[m - 1]} ${gun} ${time}`;
}

/** Tarihin bulunduğu haftanın (Pzt–Paz) ilk ve son günü. */
export function haftaAraligi(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  const fark = (d.getUTCDay() + 6) % 7;
  const pzt = new Date(d.getTime() - fark * 86400000);
  const paz = new Date(pzt.getTime() + 6 * 86400000);
  return { bas: pzt.toISOString().slice(0, 10), son: paz.toISOString().slice(0, 10) };
}

export type Musaitlik = {
  calendarRefId: string;
  teacherName: string;
  slots: string[];
  error?: string;
};

/**
 * Her çeyrek saatte (:00 :15 :30 :45) başlayan ve hiçbir dolu aralıkla çakışmayan 15 dakikalık
 * randevu saatleri. Randevular arka arkaya verilebilir; mola yoktur.
 */
export function bosSaatler(dolu: { start: number; end: number }[], bas: number, son: number, sure = SURE_DK): string[] {
  const slots: string[] = [];
  for (let s = Math.ceil(bas / 15) * 15; s + sure <= son; s += 15) {
    const e = s + sure;
    if (!dolu.some((d) => d.start < e && d.end > s)) slots.push(saat(s));
  }
  return slots;
}

/** Bir gün için her hocanın boş 15 dakikalık başlangıç saatleri; bugün için yalnız şu andan sonrası. */
export async function musaitlikHesapla(date: string, aralik?: { bas?: string; son?: string }): Promise<Musaitlik[]> {
  const takvimler = await prisma.appointmentCalendar.findMany({ where: { isActive: true }, orderBy: { teacherName: "asc" } });
  const simdi = simdiTR();
  const bas = Math.max(GUN_BASI, aralik?.bas ? dk(aralik.bas) : 0, date === simdi.tarih ? dk(simdi.saat) + 1 : 0);
  const son = Math.min(GUN_SONU, aralik?.son ? dk(aralik.son) : 1440);

  return Promise.all(
    takvimler.map(async (t) => {
      try {
        const dolu = await getBusyIntervals(t.calendarId, date);
        // Google'a henüz yansımamış olabilecek kendi randevularımızı da dolu say.
        const bizim = await prisma.appointment.findMany({
          where: { calendarRefId: t.id, date, status: "scheduled" },
          select: { time: true, durationMin: true },
        });
        for (const r of bizim) dolu.push({ start: dk(r.time), end: dk(r.time) + r.durationMin, title: "randevu" });
        // Hocanın birebir dersleri (takvimine düşmemiş eski dersler dahil) de dolu.
        if (t.teacherEmail) dolu.push(...(await birebirDolu(t.teacherEmail, date)));

        const slots = bosSaatler(dolu, bas, son);
        return { calendarRefId: t.id, teacherName: t.teacherName, slots };
      } catch (e) {
        return { calendarRefId: t.id, teacherName: t.teacherName, slots: [], error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
}

export const DERS_DK = 45; // birebir ders süresi

/** Takvim e-postası bu adres olan eğitmen(ler)in o günkü planlı birebir dersleri. */
export async function birebirDolu(email: string, date: string) {
  const dersler = await prisma.plannedLesson.findMany({
    where: { date, status: "scheduled", student: { educator: { calendarEmail: email.toLowerCase() } } },
    select: { time: true },
  });
  return dersler.map((d) => ({ start: dk(d.time), end: dk(d.time) + DERS_DK, title: "birebir" }));
}

/** Eğitmenin gelişim randevu takvimi (eğitmen kaydındaki takvim e-postası = hoca takvimindeki e-posta). */
export async function egitmenTakvimi(educatorId: string | null | undefined) {
  if (!educatorId) return null;
  const e = await prisma.educator.findUnique({ where: { id: educatorId }, select: { calendarEmail: true } });
  if (!e?.calendarEmail) return null;
  return prisma.appointmentCalendar.findFirst({ where: { teacherEmail: e.calendarEmail.toLowerCase(), isActive: true } });
}

/** Birebir ders için eğitmenin o günkü boş 45 dakikalık başlangıç saatleri (çeyrek saat düzeni). */
export async function birebirMusaitlik(educatorId: string, date: string) {
  const takvim = await egitmenTakvimi(educatorId);
  if (!takvim) return { bagli: false as const };
  const dolu = await getBusyIntervals(takvim.calendarId, date);
  const randevular = await prisma.appointment.findMany({
    where: { calendarRefId: takvim.id, date, status: "scheduled" },
    select: { time: true, durationMin: true },
  });
  for (const r of randevular) dolu.push({ start: dk(r.time), end: dk(r.time) + r.durationMin, title: "randevu" });
  if (takvim.teacherEmail) dolu.push(...(await birebirDolu(takvim.teacherEmail, date)));
  const simdi = simdiTR();
  const bas = Math.max(GUN_BASI, date === simdi.tarih ? dk(simdi.saat) + 1 : 0);
  return { bagli: true as const, takvimAdi: takvim.calendarName || takvim.teacherName, slots: bosSaatler(dolu, bas, GUN_SONU, DERS_DK) };
}

/** Seçilen saat hâlâ boş mu (randevu kaydetmeden hemen önce tekrar kontrol). */
export async function saatBosMu(calendarRefId: string, calendarId: string, date: string, time: string) {
  const s = dk(time);
  const e = s + SURE_DK;
  const dolu = await getBusyIntervals(calendarId, date);
  const takvim = await prisma.appointmentCalendar.findUnique({ where: { id: calendarRefId }, select: { teacherEmail: true } });
  if (takvim?.teacherEmail) dolu.push(...(await birebirDolu(takvim.teacherEmail, date)));
  if (dolu.some((d) => d.start < e && d.end > s)) return false;
  const cakisan = await prisma.appointment.count({
    where: { calendarRefId, date, status: "scheduled", time: { gt: saat(Math.max(0, s - SURE_DK)), lt: saat(e) } },
  });
  return cakisan === 0;
}

async function leadHazirla(randevu: { id: string; phone: string; studentName: string; kommoLeadId: number | null }) {
  if (randevu.kommoLeadId) return randevu.kommoLeadId;
  // Aynı öğrencinin önceki randevusunun lead'ini kullan.
  const onceki = await prisma.appointment.findFirst({
    where: { phone: randevu.phone, kommoLeadId: { not: null }, id: { not: randevu.id } },
    orderBy: { createdAt: "desc" },
    select: { kommoLeadId: true },
  });
  if (onceki?.kommoLeadId) {
    const l = await kommo<{ id: number }>("GET", `/leads/${onceki.kommoLeadId}`).catch(() => null);
    if (l?.id) return l.id;
  }
  const kisiId = await kisiBulVeyaAc(randevu.phone, randevu.studentName);
  const yeni = await kommo<{ _embedded: { leads: { id: number }[] } }>("POST", "/leads", [
    {
      name: `Gelişim: ${randevu.studentName}`,
      pipeline_id: PIPELINE_ID,
      status_id: STATUS_ID,
      _embedded: { contacts: [{ id: kisiId }], tags: [{ name: "gelisim-randevu" }] },
    },
  ]);
  return yeni!._embedded.leads[0].id;
}

async function whatsappGonder(randevuId: string, tur: "onay" | "hatirlatma") {
  const r = await prisma.appointment.findUnique({ where: { id: randevuId }, include: { calendar: true } });
  if (!r) throw new Error("Randevu bulunamadı");
  const botId = tur === "onay" ? ONAY_BOT_ID : HATIRLATMA_BOT_ID;
  if (!botId) throw new Error(`${tur} botu tanımlı değil`);
  const leadId = await leadHazirla(r);
  if (leadId !== r.kommoLeadId) await prisma.appointment.update({ where: { id: r.id }, data: { kommoLeadId: leadId } });
  await kommo("PATCH", `/leads/${leadId}`, {
    custom_fields_values: [
      { field_id: CF_EGITMEN, values: [{ value: `${r.calendar.teacherName} Hoca` }] },
      { field_id: CF_ZAMAN, values: [{ value: tur === "onay" ? trZaman(r.date, r.time) : r.time }] },
      { field_id: CF_LINK, values: [{ value: r.meetLink || "Bağlantı eğitmenimiz tarafından iletilecek." }] },
    ],
  });
  await kommo("POST", "/salesbot/run", [{ bot_id: botId, entity_id: leadId, entity_type: 2 }], "/api/v2");
}

export async function onayGonder(randevuId: string) {
  try {
    await whatsappGonder(randevuId, "onay");
    await prisma.appointment.update({ where: { id: randevuId }, data: { confirmSentAt: new Date(), confirmError: null } });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    await prisma.appointment.update({ where: { id: randevuId }, data: { confirmError: m.slice(0, 300) } });
  }
}

/** Randevu günü 09:00'dan sonra, henüz hatırlatılmamış randevulara WhatsApp hatırlatması. */
export async function randevuHatirlatmalariniGonder() {
  const ozet = { aktif: !!HATIRLATMA_BOT_ID, gonderilen: [] as string[], hatalar: [] as string[] };
  const { tarih, saat: simdi } = simdiTR();
  if (simdi < "09:00" || !HATIRLATMA_BOT_ID) return ozet;
  const liste = await prisma.appointment.findMany({
    where: { date: tarih, status: "scheduled", reminderSentAt: null, reminderAttempts: { lt: MAX_DENEME } },
    orderBy: { time: "asc" },
  });
  for (const r of liste) {
    if (r.time <= simdi) continue;
    try {
      await whatsappGonder(r.id, "hatirlatma");
      await prisma.appointment.update({
        where: { id: r.id },
        data: { reminderSentAt: new Date(), reminderError: null, reminderAttempts: { increment: 1 } },
      });
      ozet.gonderilen.push(`${r.studentName} ${r.time}`);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      ozet.hatalar.push(`${r.studentName} ${r.time}: ${m}`);
      await prisma.appointment.update({
        where: { id: r.id },
        data: { reminderError: m.slice(0, 300), reminderAttempts: { increment: 1 } },
      });
    }
  }
  return ozet;
}
