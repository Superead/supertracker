import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, createAuditLog } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, basePrice, personCount, duration, productId, paymentLinkPayTR, paymentLinkSuperead } = await request.json();

  const pkg = await prisma.package.create({
    data: { name, basePrice, personCount: personCount || 1, duration: duration || "yearly", productId, paymentLinkPayTR: paymentLinkPayTR || null, paymentLinkSuperead: paymentLinkSuperead || null },
  });

  await createAuditLog(user.id, "create", "package", pkg.id, null, { name, basePrice, productId });

  return Response.json(pkg, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, name, basePrice, personCount, duration, isActive, paymentLinkPayTR, paymentLinkSuperead } = await request.json();

  const old = await prisma.package.findUnique({ where: { id } });
  const pkg = await prisma.package.update({
    where: { id },
    data: { name, basePrice, personCount, duration, isActive, paymentLinkPayTR, paymentLinkSuperead },
  });

  await createAuditLog(user.id, "update", "package", id, old, { name, basePrice, isActive });

  return Response.json(pkg);
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await request.json();

  const hasSales = await prisma.sale.count({ where: { packageId: id } });
  if (hasSales > 0) {
    await prisma.package.update({ where: { id }, data: { isActive: false } });
    await createAuditLog(user.id, "update", "package", id, null, { isActive: false, reason: "deactivated - has sales" });
    return Response.json({ message: "Satışı olan paket pasife alındı" });
  }

  await prisma.package.delete({ where: { id } });
  await createAuditLog(user.id, "delete", "package", id, null, null);

  return Response.json({ message: "Paket silindi" });
}
