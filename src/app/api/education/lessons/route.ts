import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const studentId = request.nextUrl.searchParams.get("studentId");
  if (!studentId) return Response.json({ error: "studentId gerekli" }, { status: 400 });

  const logs = await prisma.lessonLog.findMany({
    where: { studentId },
    include: { educator: { select: { name: true } } },
    orderBy: { lessonNumber: "asc" },
  });

  return Response.json(logs);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const educator = await prisma.educator.findUnique({
    where: { userId: user.id },
    select: { id: true, name: true, user: { select: { email: true } } },
  });
  if (!educator && user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { studentId, date, time, notes } = await request.json();
  if (!studentId || !date) {
    return Response.json({ error: "studentId ve tarih gerekli" }, { status: 400 });
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { educator: { select: { name: true } } },
  });
  if (!student) return Response.json({ error: "Öğrenci bulunamadı" }, { status: 404 });

  if (student.completedLessons >= student.totalLessons) {
    return Response.json({ error: "Tüm dersler tamamlandı" }, { status: 400 });
  }

  const newLessonNumber = student.completedLessons + 1;
  const isLastLesson = newLessonNumber >= student.totalLessons;

  let meetLink: string | null = null;
  let calendarEventId: string | null = null;

  if (time) {
    try {
      const educatorName = educator?.name || "Admin";
      const calResult = await createCalendarEvent({
        summary: `Ders: ${student.studentName} - ${educatorName}`,
        description: `Ders #${newLessonNumber}/${student.totalLessons}\nÖğrenci: ${student.studentName}\nEğitmen: ${educatorName}${notes ? `\nNot: ${notes}` : ""}`,
        date,
        time,
        attendeeEmails: [student.email, educator?.user?.email].filter(Boolean) as string[],
      });
      if (calResult) {
        meetLink = calResult.meetLink;
        calendarEventId = calResult.eventId || null;
      }
    } catch (e) {
      console.error("Google Calendar event oluşturulamadı:", e);
    }
  }

  const [log] = await prisma.$transaction([
    prisma.lessonLog.create({
      data: {
        lessonNumber: newLessonNumber,
        date,
        time: time || null,
        notes: notes || null,
        meetLink,
        calendarEventId,
        studentId,
        educatorId: educator?.id || null,
      },
    }),
    prisma.student.update({
      where: { id: studentId },
      data: {
        completedLessons: newLessonNumber,
        status: isLastLesson ? "completed" : "in_progress",
      },
    }),
  ]);

  return Response.json(log, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const educator = await prisma.educator.findUnique({ where: { userId: user.id } });
  if (!educator && user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { logId, notes, date, time } = await request.json();
  if (!logId) return Response.json({ error: "logId gerekli" }, { status: 400 });

  const log = await prisma.lessonLog.findUnique({ where: { id: logId } });
  if (!log) return Response.json({ error: "Kayıt bulunamadı" }, { status: 404 });

  const updateData: Record<string, unknown> = {};
  if (notes !== undefined) updateData.notes = notes || null;
  if (date !== undefined) updateData.date = date;
  if (time !== undefined) updateData.time = time || null;

  const updated = await prisma.lessonLog.update({ where: { id: logId }, data: updateData });
  return Response.json(updated);
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const educator = await prisma.educator.findUnique({ where: { userId: user.id } });
  if (!educator && user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { logId, studentId } = await request.json();
  if (!logId || !studentId) return Response.json({ error: "logId ve studentId gerekli" }, { status: 400 });

  const log = await prisma.lessonLog.findUnique({ where: { id: logId } });
  if (!log) return Response.json({ error: "Kayıt bulunamadı" }, { status: 404 });

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return Response.json({ error: "Öğrenci bulunamadı" }, { status: 404 });

  if (log.calendarEventId) {
    try {
      await deleteCalendarEvent(log.calendarEventId);
    } catch (e) {
      console.error("Google Calendar event silinemedi:", e);
    }
  }

  await prisma.$transaction([
    prisma.lessonLog.delete({ where: { id: logId } }),
    prisma.student.update({
      where: { id: studentId },
      data: {
        completedLessons: Math.max(0, student.completedLessons - 1),
        status: student.completedLessons - 1 <= 0 ? "planned" : "in_progress",
      },
    }),
  ]);

  const remaining = await prisma.lessonLog.findMany({
    where: { studentId },
    orderBy: { lessonNumber: "asc" },
  });
  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i].lessonNumber !== i + 1) {
      await prisma.lessonLog.update({ where: { id: remaining[i].id }, data: { lessonNumber: i + 1 } });
    }
  }

  return Response.json({ success: true });
}
