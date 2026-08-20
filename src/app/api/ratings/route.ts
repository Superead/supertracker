import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Public: get rating info by id (for the parent-facing page)
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "id gerekli" }, { status: 400 });

  const rating = await prisma.educatorRating.findUnique({
    where: { id },
    include: {
      educator: { select: { name: true } },
      student: { select: { studentName: true } },
    },
  });
  if (!rating) return Response.json({ error: "Değerlendirme bulunamadı" }, { status: 404 });

  return Response.json({
    id: rating.id,
    educatorName: rating.educator.name,
    studentName: rating.student.studentName,
    alreadyRated: !!rating.ratedAt,
  });
}

// Auth (admin/internal): create a rating link for a student
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const educator = await prisma.educator.findUnique({ where: { userId: user.id } });
  const canManage = user.role === "admin" || !!educator?.isInternal;
  if (!canManage) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { studentId } = await request.json();
  if (!studentId) return Response.json({ error: "studentId gerekli" }, { status: 400 });

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return Response.json({ error: "Öğrenci bulunamadı" }, { status: 404 });
  if (!student.educatorId) return Response.json({ error: "Öğrenciye eğitmen atanmamış" }, { status: 400 });

  // Reuse pending (un-answered) rating for the same student+educator if it exists
  const existing = await prisma.educatorRating.findFirst({
    where: { studentId, educatorId: student.educatorId, ratedAt: null },
  });
  if (existing) return Response.json(existing);

  const rating = await prisma.educatorRating.create({
    data: { studentId, educatorId: student.educatorId },
  });

  return Response.json(rating, { status: 201 });
}

// Public: parent submits the rating
export async function PATCH(request: NextRequest) {
  const { id, score, comment } = await request.json();
  if (!id || !score || score < 1 || score > 5) {
    return Response.json({ error: "Geçersiz puan" }, { status: 400 });
  }

  const rating = await prisma.educatorRating.findUnique({ where: { id } });
  if (!rating) return Response.json({ error: "Değerlendirme bulunamadı" }, { status: 404 });
  if (rating.ratedAt) return Response.json({ error: "Bu değerlendirme zaten yapılmış" }, { status: 400 });

  const updated = await prisma.educatorRating.update({
    where: { id },
    data: { score, comment: comment || null, ratedAt: new Date() },
  });

  return Response.json(updated);
}
