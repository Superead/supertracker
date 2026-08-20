import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function getContext(userId: string, role: string) {
  const educator = await prisma.educator.findUnique({ where: { userId } });
  return {
    educator,
    isAdmin: role === "admin",
    canManage: role === "admin" || !!educator?.isInternal,
  };
}

// GET: external educators see open listings + their request statuses
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { educator } = await getContext(user.id, user.role);
  if (!educator && user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const listings = await prisma.student.findMany({
    where: { isActive: true, isListed: true, educatorId: null },
    select: {
      id: true, studentName: true, grade: true, schedule: true,
      offerPrice: true, listingNote: true, totalLessons: true,
      requests: { select: { educatorId: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const result = listings.map((l) => {
    const nameParts = l.studentName.trim().split(/\s+/);
    const maskedName = nameParts.length > 1
      ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
      : nameParts[0];
    return {
      id: l.id,
      studentName: maskedName,
      grade: l.grade,
      schedule: l.schedule,
      offerPrice: l.offerPrice,
      listingNote: l.listingNote,
      totalLessons: l.totalLessons,
      requestCount: l.requests.length,
      myRequest: educator ? l.requests.some((r) => r.educatorId === educator.id) : false,
    };
  });

  // Recently rejected requests of this educator (so they get feedback)
  let rejected: { studentName: string; createdAt: Date }[] = [];
  if (educator) {
    const rejectedReqs = await prisma.studentRequest.findMany({
      where: {
        educatorId: educator.id,
        status: "rejected",
        createdAt: { gte: new Date(Date.now() - 14 * 24 * 3600000) },
      },
      include: { student: { select: { studentName: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    rejected = rejectedReqs.map((r) => {
      const parts = r.student.studentName.trim().split(/\s+/);
      const masked = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
      return { studentName: masked, createdAt: r.createdAt };
    });
  }

  return Response.json({ listings: result, rejected });
}

// POST with action: "list" | "unlist" | "request" | "assign"
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { educator, canManage } = await getContext(user.id, user.role);
  const body = await request.json();
  const { action, studentId } = body;

  if (!studentId || !action) {
    return Response.json({ error: "studentId ve action gerekli" }, { status: 400 });
  }

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return Response.json({ error: "Öğrenci bulunamadı" }, { status: 404 });

  if (action === "list") {
    if (!canManage) return Response.json({ error: "Forbidden" }, { status: 403 });
    const updated = await prisma.student.update({
      where: { id: studentId },
      data: {
        isListed: true,
        offerPrice: body.offerPrice || null,
        listingNote: body.listingNote || null,
      },
    });
    return Response.json(updated);
  }

  if (action === "unlist") {
    if (!canManage) return Response.json({ error: "Forbidden" }, { status: 403 });
    const updated = await prisma.student.update({
      where: { id: studentId },
      data: { isListed: false },
    });
    return Response.json(updated);
  }

  if (action === "request") {
    if (!educator) return Response.json({ error: "Sadece eğitmenler talep edebilir" }, { status: 403 });
    if (!student.isListed || student.educatorId) {
      return Response.json({ error: "Bu ilan artık aktif değil" }, { status: 400 });
    }
    const existing = await prisma.studentRequest.findUnique({
      where: { studentId_educatorId: { studentId, educatorId: educator.id } },
    });
    if (existing) return Response.json(existing);

    const req = await prisma.studentRequest.create({
      data: { studentId, educatorId: educator.id },
    });
    return Response.json(req, { status: 201 });
  }

  if (action === "assign") {
    if (!canManage) return Response.json({ error: "Forbidden" }, { status: 403 });
    const { educatorId } = body;
    if (!educatorId) return Response.json({ error: "educatorId gerekli" }, { status: 400 });

    await prisma.$transaction([
      prisma.student.update({
        where: { id: studentId },
        data: {
          educatorId,
          isListed: false,
          status: student.status === "pending" ? "planned" : student.status,
        },
      }),
      prisma.studentRequest.updateMany({
        where: { studentId, educatorId },
        data: { status: "selected" },
      }),
      prisma.studentRequest.updateMany({
        where: { studentId, educatorId: { not: educatorId } },
        data: { status: "rejected" },
      }),
    ]);

    return Response.json({ success: true });
  }

  return Response.json({ error: "Geçersiz action" }, { status: 400 });
}
