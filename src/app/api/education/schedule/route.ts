import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createCalendarEvent, deleteCalendarEvent, updateCalendarEventTime } from "@/lib/google";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/*
 * Birebir öğrencinin ders programı (ileride yapılacak dersler).
 * GET    ?studentId=…                       → planlanan dersler
 * POST   { studentId, date, time }            → bir sonraki dersi ekler (eğitmen dersleri tek tek planlar)
 * POST   { studentId, days, time, startDate } → kalan dersleri seçilen günlere toplu dağıtır (eski planı değiştirir)
 * PATCH  { id, date, time }                  → tek dersi taşır
 * DELETE { id }                              → tek dersi iptal eder
 * Ders yapıldığında eğitmen yine "Ders Ekle" der; o numaralı plan "done" olur (lessons route).
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

async function yetki(studentId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  const educator = await prisma.educator.findUnique({
    where: { userId: user.id },
    select: { id: true, name: true, isInternal: true, user: { select: { email: true } } },
  });
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { educator: { select: { name: true, calendarEmail: true, user: { select: { email: true } } } } },
  });
  if (!student) return { error: Response.json({ error: "Öğrenci bulunamadı" }, { status: 404 }) };
  const ok = user.role === "admin" || educator?.isInternal || (educator && student.educatorId === educator.id);
  if (!ok) return { error: Response.json({ error: "Forbidden" }, { status: 403 }) };
  return { user, educator, student };
}

/** Takvim davetinin gideceği adresler: veli/öğrenci e-postası + eğitmenin gerçek e-postası. */
function davetliler(student: { email: string | null; educator: { calendarEmail: string | null; user: { email: string } | null } | null }) {
  const girisEpostasi = student.educator?.user?.email || "";
  // Sistem giriş adresleri (…@egitmen.superead.com) gerçek posta kutusu değil; davet gönderme.
  const egitmen = student.educator?.calendarEmail || (girisEpostasi.endsWith("@egitmen.superead.com") ? "" : girisEpostasi);
  return [student.email, egitmen].filter(Boolean) as string[];
}

/** Planlanan dersleri tarih sırasına göre yeniden numaralar (tamamlananlardan sonra gelir). */
async function yenidenNumarala(studentId: string) {
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { completedLessons: true } });
  const planli = await prisma.plannedLesson.findMany({
    where: { studentId, status: "scheduled" },
    orderBy: [{ date: "asc" }, { time: "asc" }],
  });
  for (let i = 0; i < planli.length; i++) {
    const no = (student?.completedLessons || 0) + 1 + i;
    if (planli[i].lessonNumber !== no) {
      await prisma.plannedLesson.update({ where: { id: planli[i].id }, data: { lessonNumber: no } });
    }
  }
}

/** Türkiye saatine göre bugünün tarihi (YYYY-MM-DD). */
function bugunTR() {
  return new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const studentId = request.nextUrl.searchParams.get("studentId");
  if (!studentId) return Response.json({ error: "studentId gerekli" }, { status: 400 });
  const y = await yetki(studentId);
  if (y.error) return y.error;
  const lessons = await prisma.plannedLesson.findMany({
    where: { studentId },
    orderBy: [{ date: "asc" }, { time: "asc" }],
  });
  return Response.json(lessons);
}

export async function POST(request: NextRequest) {
  const { studentId, days, time, startDate, date } = await request.json();
  if (!studentId) return Response.json({ error: "studentId gerekli" }, { status: 400 });
  const y = await yetki(studentId);
  if (y.error) return y.error;
  const { student } = y;

  // Tek ders ekleme: { studentId, date, time }
  if (date !== undefined) {
    if (!DATE_RE.test(date || "") || !TIME_RE.test(time || "")) {
      return Response.json({ error: "Tarih ve saat gerekli" }, { status: 400 });
    }
    if (date < bugunTR()) return Response.json({ error: "Tarih geçmişte olamaz" }, { status: 400 });
    const planli = await prisma.plannedLesson.count({ where: { studentId, status: "scheduled" } });
    if (student.completedLessons + planli >= student.totalLessons) {
      return Response.json({ error: `${student.totalLessons} dersin hepsi planlanmış veya yapılmış` }, { status: 400 });
    }
    const no = student.completedLessons + planli + 1;
    const egitmen = student.educator?.name || "Eğitmen";
    let meetLink: string | null = null;
    let calendarEventId: string | null = null;
    try {
      const cal = await createCalendarEvent({
        summary: `Hızlı okuma dersi: ${student.studentName} - ${egitmen}`,
        description: `Süper Hızlı Okuma birebir ders\nÖğrenci: ${student.studentName}\nEğitmen: ${egitmen}`,
        date,
        time,
        attendeeEmails: davetliler(student),
      });
      meetLink = cal?.meetLink || null;
      calendarEventId = cal?.eventId || null;
    } catch (e) {
      console.error("Google Calendar etkinliği oluşturulamadı:", e);
    }
    const yeni = await prisma.plannedLesson.create({
      data: { studentId, lessonNumber: no, date, time, meetLink, calendarEventId },
    });
    await yenidenNumarala(studentId);
    if (student.status === "pending") await prisma.student.update({ where: { id: studentId }, data: { status: "planned" } });
    return Response.json(yeni, { status: 201 });
  }

  const gunler = Array.isArray(days) ? [...new Set(days.map(Number).filter((d) => d >= 0 && d <= 6))] : [];
  if (!gunler.length) return Response.json({ error: "En az bir gün seçin" }, { status: 400 });
  if (!TIME_RE.test(time || "")) return Response.json({ error: "Saat SS:DD biçiminde olmalı" }, { status: 400 });
  if (!DATE_RE.test(startDate || "")) return Response.json({ error: "Başlangıç tarihi gerekli" }, { status: 400 });
  if (startDate < bugunTR()) return Response.json({ error: "Başlangıç tarihi geçmişte olamaz" }, { status: 400 });

  const kalan = student.totalLessons - student.completedLessons;
  if (kalan <= 0) return Response.json({ error: "Tüm dersler tamamlanmış" }, { status: 400 });

  // Eski planın henüz yapılmamış derslerini kaldır (takvimden de).
  const eskiler = await prisma.plannedLesson.findMany({ where: { studentId, status: "scheduled" } });
  for (const e of eskiler) {
    if (e.calendarEventId) await deleteCalendarEvent(e.calendarEventId).catch(() => {});
  }
  await prisma.plannedLesson.deleteMany({ where: { studentId, status: "scheduled" } });

  // Seçilen haftanın günlerine göre kalan derslerin tarihlerini çıkar.
  const tarihler: string[] = [];
  const d = new Date(`${startDate}T12:00:00Z`);
  for (let i = 0; tarihler.length < kalan && i < 400; i++) {
    if (gunler.includes(d.getUTCDay())) tarihler.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }

  const egitmen = student.educator?.name || "Eğitmen";
  const olusan = [];
  for (let i = 0; i < tarihler.length; i++) {
    const no = student.completedLessons + 1 + i;
    let meetLink: string | null = null;
    let calendarEventId: string | null = null;
    try {
      const cal = await createCalendarEvent({
        summary: `Hızlı okuma dersi: ${student.studentName} - ${egitmen}`,
        description: `Süper Hızlı Okuma birebir ders\nÖğrenci: ${student.studentName}\nEğitmen: ${egitmen}`,
        date: tarihler[i],
        time,
        attendeeEmails: davetliler(student),
      });
      meetLink = cal?.meetLink || null;
      calendarEventId = cal?.eventId || null;
    } catch (e) {
      console.error("Google Calendar etkinliği oluşturulamadı:", e);
    }
    olusan.push(
      await prisma.plannedLesson.create({
        data: { studentId, lessonNumber: no, date: tarihler[i], time, meetLink, calendarEventId },
      }),
    );
  }

  const gunAdlari = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  await prisma.student.update({
    where: { id: studentId },
    data: {
      schedule: `${[...gunler].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((g) => gunAdlari[g]).join(", ")} ${time}`,
      ...(student.status === "pending" ? { status: "planned" } : {}),
    },
  });

  return Response.json(olusan, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { id, date, time } = await request.json();
  const plan = id ? await prisma.plannedLesson.findUnique({ where: { id } }) : null;
  if (!plan) return Response.json({ error: "Ders bulunamadı" }, { status: 404 });
  const y = await yetki(plan.studentId);
  if (y.error) return y.error;
  if (plan.status !== "scheduled") return Response.json({ error: "Sadece planlanan ders taşınabilir" }, { status: 400 });
  if (!DATE_RE.test(date || "") || !TIME_RE.test(time || "")) {
    return Response.json({ error: "Tarih ve saat gerekli" }, { status: 400 });
  }

  if (plan.calendarEventId) {
    try {
      await updateCalendarEventTime(plan.calendarEventId, date, time);
    } catch (e) {
      console.error("Google Calendar etkinliği taşınamadı:", e);
    }
  }
  const tarihDegisti = date !== plan.date;
  const updated = await prisma.plannedLesson.update({
    where: { id },
    data: {
      date,
      time,
      // Başka güne taşındıysa yeni gün sabahı tekrar hatırlatılsın.
      ...(tarihDegisti ? { reminderSentAt: null, reminderError: null, reminderAttempts: 0 } : {}),
    },
  });
  await yenidenNumarala(plan.studentId);
  return Response.json(updated);
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  const plan = id ? await prisma.plannedLesson.findUnique({ where: { id } }) : null;
  if (!plan) return Response.json({ error: "Ders bulunamadı" }, { status: 404 });
  const y = await yetki(plan.studentId);
  if (y.error) return y.error;
  if (plan.status !== "scheduled") return Response.json({ error: "Sadece planlanan ders iptal edilebilir" }, { status: 400 });
  if (plan.calendarEventId) await deleteCalendarEvent(plan.calendarEventId).catch(() => {});
  const updated = await prisma.plannedLesson.update({ where: { id }, data: { status: "cancelled" } });
  await yenidenNumarala(plan.studentId);
  return Response.json(updated);
}
