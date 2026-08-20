import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

async function canManageEducation(userId: string, role: string): Promise<boolean> {
  if (role === "admin") return true;
  const educator = await prisma.educator.findUnique({ where: { userId } });
  return !!educator?.isInternal;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(await canManageEducation(user.id, user.role))) return Response.json({ error: "Forbidden" }, { status: 403 });

  const status = request.nextUrl.searchParams.get("status");
  const educatorId = request.nextUrl.searchParams.get("educatorId");

  const where: Record<string, unknown> = { isActive: true };
  if (status) where.status = status;
  if (educatorId) where.educatorId = educatorId;

  const students = await prisma.student.findMany({
    where,
    include: {
      educator: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(students);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(await canManageEducation(user.id, user.role))) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { studentName, parentName, parentPhone, email, grade, totalLessons, schedule, notes, educatorId, paymentAmount } = body;

  if (!studentName) return Response.json({ error: "Öğrenci adı gerekli" }, { status: 400 });

  const student = await prisma.student.create({
    data: {
      studentName,
      parentName: parentName || null,
      parentPhone: parentPhone || null,
      email: email || null,
      grade: grade || null,
      totalLessons: totalLessons || 12,
      schedule: schedule || null,
      notes: notes || null,
      educatorId: educatorId || null,
      paymentAmount: paymentAmount || null,
      status: educatorId ? "planned" : "pending",
    },
  });

  return Response.json(student, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(await canManageEducation(user.id, user.role))) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { id, ...data } = body;

  if (!id) return Response.json({ error: "ID gerekli" }, { status: 400 });

  const student = await prisma.student.update({
    where: { id },
    data,
  });

  return Response.json(student);
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(await canManageEducation(user.id, user.role))) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await request.json();
  await prisma.student.update({ where: { id }, data: { isActive: false } });

  return Response.json({ success: true });
}
