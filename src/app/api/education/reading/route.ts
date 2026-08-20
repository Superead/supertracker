import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function canAccessStudent(userId: string, role: string, studentId: string) {
  if (role === "admin") return true;
  const educator = await prisma.educator.findUnique({ where: { userId } });
  if (!educator) return false;
  if (educator.isInternal) return true;
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  return student?.educatorId === educator.id;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const studentId = request.nextUrl.searchParams.get("studentId");
  if (!studentId) return Response.json({ error: "studentId gerekli" }, { status: 400 });

  if (!(await canAccessStudent(user.id, user.role, studentId))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const results = await prisma.readingResult.findMany({
    where: { studentId },
    orderBy: { textNumber: "asc" },
  });

  return Response.json(results);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { studentId, results } = await request.json();
  if (!studentId || !Array.isArray(results)) {
    return Response.json({ error: "studentId ve results gerekli" }, { status: 400 });
  }

  if (!(await canAccessStudent(user.id, user.role, studentId))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  for (const r of results) {
    const textNumber = Number(r.textNumber);
    if (textNumber < 1 || textNumber > 4) continue;
    const wpm = r.wpm !== null && r.wpm !== undefined && r.wpm !== "" ? Number(r.wpm) : null;
    const correct = r.correct !== null && r.correct !== undefined && r.correct !== "" ? Number(r.correct) : null;

    await prisma.readingResult.upsert({
      where: { studentId_textNumber: { studentId, textNumber } },
      update: { wpm, correct },
      create: { studentId, textNumber, wpm, correct },
    });
  }

  const updated = await prisma.readingResult.findMany({
    where: { studentId },
    orderBy: { textNumber: "asc" },
  });

  return Response.json(updated);
}
