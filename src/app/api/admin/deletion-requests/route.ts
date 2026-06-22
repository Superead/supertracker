import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, createAuditLog } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const requests = await prisma.deletionRequest.findMany({
    where: { status: "pending" },
    include: {
      sale: {
        include: {
          package: { include: { product: true } },
          user: { select: { name: true, team: { select: { name: true } } } },
        },
      },
      requestedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(requests);
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { requestId, action } = await request.json();

  const req = await prisma.deletionRequest.findUnique({
    where: { id: requestId },
    include: { sale: true },
  });

  if (!req) return Response.json({ error: "Talep bulunamadı" }, { status: 404 });

  if (action === "approve") {
    await prisma.$transaction([
      prisma.deletionRequest.update({
        where: { id: requestId },
        data: { status: "approved", approvedById: user.id, approvedAt: new Date() },
      }),
      prisma.sale.update({
        where: { id: req.saleId },
        data: { isDeleted: true, deletedAt: new Date() },
      }),
    ]);
    await createAuditLog(user.id, "deletion_approve", "sale", req.saleId, req.sale, null);
  } else {
    await prisma.deletionRequest.update({
      where: { id: requestId },
      data: { status: "rejected", approvedById: user.id, approvedAt: new Date() },
    });
    await createAuditLog(user.id, "deletion_reject", "sale", req.saleId, null, null);
  }

  return Response.json({ ok: true });
}
