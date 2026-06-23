import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, createAuditLog } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const sales = await prisma.sale.findMany({
    where: { isBackdated: true, isDeleted: false },
    include: {
      user: { select: { id: true, name: true, team: { select: { name: true, color: true } } } },
      package: { include: { product: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(sales);
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { saleId, action } = await request.json();
  if (!saleId || !action) {
    return Response.json({ error: "Geçersiz veri" }, { status: 400 });
  }

  if (action === "approve") {
    await prisma.sale.update({
      where: { id: saleId },
      data: { backdateApproved: true, backdateApprovedBy: user.id },
    });
    await createAuditLog(user.id, "update", "sale", saleId, null, { action: "backdate-approved" });
    return Response.json({ success: true });
  }

  if (action === "reject") {
    await prisma.sale.update({
      where: { id: saleId },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    await createAuditLog(user.id, "delete", "sale", saleId, null, { action: "backdate-rejected" });
    return Response.json({ success: true });
  }

  return Response.json({ error: "Geçersiz aksiyon" }, { status: 400 });
}
