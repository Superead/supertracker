import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const tiers = await prisma.bonusTier.findMany({
    where: { isActive: true },
    orderBy: { minAmount: "asc" },
  });
  return Response.json(tiers);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { minAmount, bonusAmount } = await request.json();
  const tier = await prisma.bonusTier.create({
    data: { minAmount, bonusAmount },
  });
  return Response.json(tier, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, minAmount, bonusAmount } = await request.json();
  if (!id) return Response.json({ error: "ID gerekli" }, { status: 400 });

  const tier = await prisma.bonusTier.update({
    where: { id },
    data: { minAmount, bonusAmount },
  });
  return Response.json(tier);
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await request.json();
  if (!id) return Response.json({ error: "ID gerekli" }, { status: 400 });

  await prisma.bonusTier.update({
    where: { id },
    data: { isActive: false },
  });
  return Response.json({ success: true });
}
