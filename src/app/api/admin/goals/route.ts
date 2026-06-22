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
    orderBy: { createdAt: "desc" },
  });
  return Response.json(goals);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { type, target, period, teamId, isGlobal } = await request.json();

  const goal = await prisma.goal.upsert({
    where: {
      id: "placeholder",
    },
    update: { target },
    create: {
      type,
      target,
      period,
      teamId: isGlobal ? null : teamId,
      isGlobal: isGlobal || false,
    },
  });

  return Response.json(goal, { status: 201 });
}
