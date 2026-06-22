import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, createAuditLog } from "@/lib/auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const sale = await prisma.sale.findUnique({ where: { id } });
  if (!sale) return Response.json({ error: "Satış bulunamadı" }, { status: 404 });

  if (user.role === "admin") {
    await prisma.sale.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    await createAuditLog(user.id, "delete", "sale", id, sale, null);
    return Response.json({ ok: true });
  }

  if (sale.userId !== user.id) {
    return Response.json({ error: "Bu satışı silme yetkiniz yok" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));

  const existing = await prisma.deletionRequest.findUnique({ where: { saleId: id } });
  if (existing) {
    return Response.json({ error: "Bu satış için zaten silme talebi var" }, { status: 400 });
  }

  const deletionRequest = await prisma.deletionRequest.create({
    data: {
      saleId: id,
      requestedById: user.id,
      reason: body.reason || "Satışçı tarafından silme talebi",
    },
  });

  await createAuditLog(user.id, "deletion_request", "sale", id, null, deletionRequest);

  return Response.json({ message: "Silme talebi gönderildi, admin onayı bekleniyor" });
}
