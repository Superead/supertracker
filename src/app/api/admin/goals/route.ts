import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const goals = await prisma.goal.findMany({
    include: { team: { select: { name: true } } },
    orderBy: { period: "desc" },
  });
  return Response.json(goals);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { type, target, period, teamId, isGlobal } = await request.json();

  const existing = await prisma.goal.findFirst({
    where: {
      type,
      period,
      isGlobal: isGlobal || false,
      ...(isGlobal ? {} : { teamId }),
    },
  });

  if (existing) {
    const goal = await prisma.goal.update({
      where: { id: existing.id },
      data: { target },
    });
    return Response.json(goal);
  }

  const goal = await prisma.goal.create({
    data: {
      type,
      target,
      period,
      teamId: isGlobal ? null : teamId,
      isGlobal: isGlobal || false,
    },
  });

  return Response.json(goal, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, target } = await request.json();
  const goal = await prisma.goal.update({
    where: { id },
    data: { target },
  });
  return Response.json(goal);
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await request.json();
  await prisma.goal.delete({ where: { id } });
  return Response.json({ success: true });
}
