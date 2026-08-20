import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const educator = await prisma.educator.findUnique({
    where: { userId: user.id },
    select: { id: true, name: true, phone: true, iban: true },
  });

  if (!educator) return Response.json({ error: "Educator not found" }, { status: 404 });
  return Response.json(educator);
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const educator = await prisma.educator.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!educator) return Response.json({ error: "Educator not found" }, { status: 404 });

  const { phone, iban } = await request.json();

  const updated = await prisma.educator.update({
    where: { id: educator.id },
    data: {
      phone: phone || null,
      iban: iban || null,
    },
    select: { id: true, name: true, phone: true, iban: true },
  });

  return Response.json(updated);
}
