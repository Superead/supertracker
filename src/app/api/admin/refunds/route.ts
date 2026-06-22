import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, createAuditLog } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return Response.json({ error: "Unauthorized" }, { status: 401 });

  const monthParam = request.nextUrl.searchParams.get("month");
  let targetYear: number, targetMonth: number;
  const now = new Date();

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    targetYear = y;
    targetMonth = m - 1;
  } else {
    targetYear = now.getFullYear();
    targetMonth = now.getMonth();
  }

  const monthStart = new Date(targetYear, targetMonth, 1);
  const monthEnd = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

  const refunds = await prisma.refund.findMany({
    where: { createdAt: { gte: monthStart, lte: monthEnd } },
    include: {
      user: { select: { id: true, name: true, team: { select: { name: true, color: true } } } },
      sale: { select: { id: true, totalPrice: true, packageType: true, personCount: true, duration: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(refunds);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { amount, reason, userId, saleId } = body;

  if (!amount || amount <= 0 || !reason || !userId) {
    return Response.json({ error: "Tutar, sebep ve satışçı gerekli" }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser) return Response.json({ error: "Satışçı bulunamadı" }, { status: 404 });

  const refund = await prisma.refund.create({
    data: {
      amount,
      reason,
      userId,
      saleId: saleId || null,
      createdById: user.id,
    },
    include: {
      user: { select: { id: true, name: true, team: { select: { name: true, color: true } } } },
      createdBy: { select: { name: true } },
    },
  });

  await createAuditLog(user.id, "create", "refund", refund.id, null, { amount, reason, userId });

  return Response.json(refund, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id } = body;

  const refund = await prisma.refund.findUnique({ where: { id } });
  if (!refund) return Response.json({ error: "İade bulunamadı" }, { status: 404 });

  await prisma.refund.delete({ where: { id } });
  await createAuditLog(user.id, "delete", "refund", id, refund, null);

  return Response.json({ success: true });
}
