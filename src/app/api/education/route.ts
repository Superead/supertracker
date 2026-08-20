import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const educator = await prisma.educator.findUnique({
    where: { userId: user.id },
  });

  if (!educator && user.role !== "admin") {
    return Response.json({ error: "Bu sayfaya erişiminiz yok" }, { status: 403 });
  }

  const isAdmin = user.role === "admin";
  const isInternal = !!educator?.isInternal;
  const canSeeAll = isAdmin || isInternal;

  const where: Record<string, unknown> = { isActive: true };
  if (!canSeeAll && educator) {
    where.educatorId = educator.id;
  }

  const students = await prisma.student.findMany({
    where,
    include: {
      educator: { select: { id: true, name: true, phone: true } },
      ...(canSeeAll ? {
        requests: {
          where: { status: "pending" },
          include: { educator: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
      } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const canSeeDetails = isAdmin || isInternal;
  const educators = await prisma.educator.findMany({
    where: { isActive: true },
    select: {
      id: true, name: true, userId: true,
      phone: canSeeDetails, iban: canSeeDetails,
      user: canSeeDetails ? { select: { id: true, email: true } } : false,
    },
    orderBy: { name: "asc" },
  });

  // Average rating per educator
  const ratingAgg = await prisma.educatorRating.groupBy({
    by: ["educatorId"],
    where: { score: { not: null } },
    _avg: { score: true },
    _count: { score: true },
  });
  const ratingMap: Record<string, { avg: number; count: number }> = {};
  for (const r of ratingAgg) {
    ratingMap[r.educatorId] = {
      avg: Math.round((r._avg.score || 0) * 10) / 10,
      count: r._count.score,
    };
  }
  const educatorsWithRatings = educators.map((e) => ({
    ...e,
    rating: ratingMap[e.id] || null,
  }));

  return Response.json({
    students,
    educators: educatorsWithRatings,
    isAdmin,
    isEducator: !!educator,
    isInternal,
    currentEducatorId: educator?.id || null,
    myProfile: educator ? { name: educator.name, phone: educator.phone, iban: educator.iban } : null,
  });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { studentId, isPaid } = await request.json();
  if (!studentId || isPaid === undefined) {
    return Response.json({ error: "studentId ve isPaid gerekli" }, { status: 400 });
  }

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return Response.json({ error: "Öğrenci bulunamadı" }, { status: 404 });

  // Only admin and internal educators can mark payments
  if (user.role !== "admin") {
    const educator = await prisma.educator.findUnique({ where: { userId: user.id }, select: { isInternal: true } });
    if (!educator?.isInternal) return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.student.update({
    where: { id: studentId },
    data: { isPaid },
  });

  return Response.json(updated);
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const educator = await prisma.educator.findUnique({
    where: { userId: user.id },
  });

  if (!educator && user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { id, completedLessons, status, notes, schedule, followUp21, surveyScore, educatorId } = body;

  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) return Response.json({ error: "Öğrenci bulunamadı" }, { status: 404 });

  const isInternal = !!educator?.isInternal;
  const isAdmin = user.role === "admin";

  // External educators can only update their own students' lesson count
  if (!isAdmin && !isInternal && educator) {
    if (student.educatorId !== educator.id) {
      return Response.json({ error: "Bu öğrenci size atanmamış" }, { status: 403 });
    }
    // External educators can only update completedLessons and status
    const updateData: Record<string, unknown> = {};
    if (completedLessons !== undefined) updateData.completedLessons = completedLessons;
    if (status !== undefined) updateData.status = status;

    const updated = await prisma.student.update({ where: { id }, data: updateData });
    return Response.json(updated);
  }

  const updateData: Record<string, unknown> = {};
  if (completedLessons !== undefined) updateData.completedLessons = completedLessons;
  if (status !== undefined) updateData.status = status;
  if (notes !== undefined) updateData.notes = notes;
  if (schedule !== undefined) updateData.schedule = schedule;
  if (followUp21 !== undefined) updateData.followUp21 = followUp21;
  if (surveyScore !== undefined) updateData.surveyScore = surveyScore;
  if (educatorId !== undefined) updateData.educatorId = educatorId;

  const updated = await prisma.student.update({
    where: { id },
    data: updateData,
  });

  return Response.json(updated);
}
