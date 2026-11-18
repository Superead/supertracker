import { NextRequest, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/google";
import { trTelefon } from "@/lib/ders-hatirlatma";
import { randevuYetkisi, saatBosMu, haftaAraligi, onayGonder, simdiTR, SURE_DK } from "@/lib/randevu";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/*
 * Gelişim randevuları.
 * GET                       → bugünden itibaren randevular (+ son 7 gün)
 * POST { phone, studentName, email?, date, time, calendarRefId, note?, force? } → randevu oluşturur
 * PATCH { id, status }      → cancelled | done | noshow
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function GET() {
  const user = await randevuYetkisi();
  if (!user) return Response.json({ error: "Forbidden" }, { status: 403 });
  const gecen = new Date(Date.now() + 3 * 3600000 - 7 * 86400000).toISOString().slice(0, 10);
  const list = await prisma.appointment.findMany({
    where: { date: { gte: gecen } },
    include: { calendar: { select: { teacherName: true } } },
    orderBy: [{ date: "asc" }, { time: "asc" }],
  });
  return Response.json(list);
}

export async function POST(request: NextRequest) {
  const user = await randevuYetkisi();
  if (!user) return Response.json({ error: "Forbidden" }, { status: 403 });
  const b = await request.json();
  const phone = trTelefon(b.phone);
  const studentName = String(b.studentName || "").trim();
  const email = String(b.email || "").trim().toLowerCase() || null;
  if (!phone) return Response.json({ error: "Geçerli bir telefon numarası girin" }, { status: 400 });
  if (!studentName) return Response.json({ error: "Öğrenci adı gerekli" }, { status: 400 });
  if (!DATE_RE.test(b.date || "") || !TIME_RE.test(b.time || "")) return Response.json({ error: "Tarih ve saat gerekli" }, { status: 400 });
  const simdi = simdiTR();
  if (b.date < simdi.tarih || (b.date === simdi.tarih && b.time <= simdi.saat)) {
    return Response.json({ error: "Geçmiş bir saate randevu verilemez" }, { status: 400 });
  }

  const takvim = await prisma.appointmentCalendar.findUnique({ where: { id: b.calendarRefId } });
  if (!takvim?.isActive) return Response.json({ error: "Eğitmen takvimi bulunamadı" }, { status: 400 });

  // Haftada en fazla 1 randevu (Pzt–Paz).
  if (!b.force) {
    const { bas, son } = haftaAraligi(b.date);
    const buHafta = await prisma.appointment.findFirst({
      where: { phone, date: { gte: bas, lte: son }, status: { in: ["scheduled", "done"] } },
      include: { calendar: { select: { teacherName: true } } },
    });
    if (buHafta) {
      return Response.json(
        { error: `Bu öğrencinin bu hafta zaten randevusu var (${buHafta.date} ${buHafta.time}, ${buHafta.calendar.teacherName}).`, haftalikLimit: true },
        { status: 409 },
      );
    }
  }

  if (!(await saatBosMu(takvim.id, takvim.calendarId, b.date, b.time))) {
    return Response.json({ error: "Bu saat artık dolu, müsait saatleri yenileyin" }, { status: 409 });
  }

  let meetLink: string | null = null;
  let calendarEventId: string | null = null;
  try {
    const cal = await createCalendarEvent({
      calendarId: takvim.calendarId,
      summary: `Gelişim görüşmesi: ${studentName}`,
      description: `Süper Hızlı Okuma gelişim görüşmesi (${SURE_DK} dk)\nÖğrenci: ${studentName}\nTelefon: +${phone}${email ? `\nE-posta: ${email}` : ""}${b.note ? `\nNot: ${b.note}` : ""}\nRandevuyu veren: ${user.name}`,
      date: b.date,
      time: b.time,
      durationMinutes: SURE_DK,
      attendeeEmails: [email, takvim.teacherEmail].filter(Boolean) as string[],
      notify: false,
    });
    meetLink = cal?.meetLink || null;
    calendarEventId = cal?.eventId || null;
  } catch (e) {
    console.error("Randevu takvim etkinliği oluşturulamadı:", e);
    return Response.json({ error: "Google Takvim'e eklenemedi: " + (e instanceof Error ? e.message : String(e)) }, { status: 502 });
  }

  const randevu = await prisma.appointment.create({
    data: {
      studentName, phone, email, date: b.date, time: b.time, durationMin: SURE_DK,
      meetLink, calendarEventId, note: b.note || null, createdByName: user.name, calendarRefId: takvim.id,
      // Bugüne verilen randevuda sabah hatırlatması geçmiştir; öğrenciye yalnız onay gider.
      ...(b.date === simdi.tarih ? { reminderSentAt: new Date() } : {}),
    },
  });
  after(() => onayGonder(randevu.id));
  return Response.json(randevu, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await randevuYetkisi();
  if (!user) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id, status } = await request.json();
  if (!["cancelled", "done", "noshow"].includes(status)) return Response.json({ error: "Geçersiz durum" }, { status: 400 });
  const r = await prisma.appointment.findUnique({ where: { id }, include: { calendar: true } });
  if (!r) return Response.json({ error: "Randevu bulunamadı" }, { status: 404 });
  if (status === "cancelled") {
    if (r.status !== "scheduled") return Response.json({ error: "Sadece bekleyen randevu iptal edilebilir" }, { status: 400 });
    if (r.date < simdiTR().tarih) return Response.json({ error: "Geçmiş randevu iptal edilemez" }, { status: 400 });
    if (r.calendarEventId) await deleteCalendarEvent(r.calendarEventId, r.calendar.calendarId).catch(() => {});
  }
  const updated = await prisma.appointment.update({ where: { id }, data: { status } });
  return Response.json(updated);
}
