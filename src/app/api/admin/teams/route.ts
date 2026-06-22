import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, createAuditLog } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const teams = await prisma.team.findMany({
    include: {
      members: {
        where: { isActive: true },
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return Response.json(teams);
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, name, color } = await request.json();

  const old = await prisma.team.findUnique({ where: { id } });
  const team = await prisma.team.update({
    where: { id },
    data: { name, color },
  });

  await createAuditLog(user.id, "update", "team", id, old, { name, color });

  return Response.json(team);
}
