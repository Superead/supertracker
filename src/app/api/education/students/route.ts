import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { studentId, isPaid } = await request.json();
  if (!studentId || isPaid === undefined) {
    return Response.json({ error: "studentId ve isPaid gerekli" }, { status: 400 });
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { educatorId: true },
  });

  if (!student) return Response.json({ error: "Student not found" }, { status: 404 });

  // Only educator of this student, internal educators, or admin can update
  if (user.role !== "admin") {
    if (user.role === "educator") {
      const educator = await prisma.educator.findUnique({
        where: { userId: user.id },
        select: { id: true, isInternal: true },
      });
      const canUpdate = educator?.id === student.educatorId || educator?.isInternal;
      if (!canUpdate) return Response.json({ error: "Forbidden" }, { status: 403 });
    } else {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const updated = await prisma.student.update({
    where: { id: studentId },
    data: { isPaid },
    select: { id: true, studentName: true, isPaid: true },
  });

  return Response.json(updated);
}
