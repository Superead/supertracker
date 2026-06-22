import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, createAuditLog } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const products = await prisma.product.findMany({
    include: {
      packages: { orderBy: { basePrice: "asc" } },
    },
    orderBy: { name: "asc" },
  });

  return Response.json(products);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, description } = await request.json();

  const product = await prisma.product.create({
    data: { name, description },
  });

  await createAuditLog(user.id, "create", "product", product.id, null, { name, description });

  return Response.json(product, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, name, description, isActive } = await request.json();

  const old = await prisma.product.findUnique({ where: { id } });
  const product = await prisma.product.update({
    where: { id },
    data: { name, description, isActive },
  });

  await createAuditLog(user.id, "update", "product", id, old, { name, description, isActive });

  return Response.json(product);
}
