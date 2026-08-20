import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, createAuditLog } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "educator") return Response.json({ error: "Forbidden" }, { status: 403 });

  const url = request.nextUrl;
  const date = url.searchParams.get("date");
  const month = url.searchParams.get("month");
  const userId = url.searchParams.get("userId");
  const teamId = url.searchParams.get("teamId");

  const where: Record<string, unknown> = { isDeleted: false };

  const pad = (n: number) => String(n).padStart(2, "0");
  if (date) {
    const start = new Date(`${date}T00:00:00+03:00`);
    const end = new Date(`${date}T23:59:59+03:00`);
    where.createdAt = { gte: start, lte: end };
  } else if (month) {
    const [y, m] = month.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const start = new Date(`${y}-${pad(m)}-01T00:00:00+03:00`);
    const end = new Date(`${y}-${pad(m)}-${pad(lastDay)}T23:59:59+03:00`);
    where.createdAt = { gte: start, lte: end };
  }

  if (userId) where.userId = userId;
  if (teamId) {
    where.user = { teamId };
  }

  const sales = await prisma.sale.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, teamId: true, team: { select: { name: true, color: true } } } },
      package: { include: { product: true } },
      deletionRequest: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(sales);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "educator") return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { personCount, duration, packageType, unitPrice, discount, discountReason, customerType, customerNote, customerEmail, customerPhone, isBackdated, backdatedNote } = body;

  if (!unitPrice || unitPrice <= 0) {
    return Response.json({ error: "Fiyat girilmelidir" }, { status: 400 });
  }

  if (isBackdated && (!backdatedNote || backdatedNote.trim().length < 3)) {
    return Response.json({ error: "Düne satış girişi için açıklama zorunludur" }, { status: 400 });
  }

  if (packageType === "birebir" && (!customerNote || customerNote.trim().length < 3)) {
    return Response.json({ error: "Birebir satışta öğrenci/veli adı zorunludur" }, { status: 400 });
  }

  const price = unitPrice;
  const discountAmount = discount || 0;
  const totalPrice = price - discountAmount;

  let createdAt: Date | undefined;
  if (isBackdated) {
    const nowTR = new Date(Date.now() + 3 * 3600000);
    const yesterday = new Date(nowTR);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yStr = `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, "0")}-${String(yesterday.getUTCDate()).padStart(2, "0")}`;
    createdAt = new Date(`${yStr}T23:59:00+03:00`);
  }

  const sale = await prisma.sale.create({
    data: {
      userId: user.id,
      personCount: personCount || 1,
      duration: duration || "yearly",
      packageType: packageType || "individual",
      unitPrice: price,
      totalPrice,
      discount: discountAmount,
      discountReason: discountReason || null,
      customerType: customerType || "new",
      customerNote: customerNote || null,
      customerEmail: customerEmail || null,
      customerPhone: customerPhone || null,
      isBackdated: isBackdated || false,
      backdatedNote: isBackdated ? backdatedNote : null,
      backdateApproved: false,
      ...(createdAt ? { createdAt } : {}),
    },
    include: {
      user: { select: { id: true, name: true, team: { select: { name: true, color: true } } } },
    },
  });

  await createAuditLog(user.id, "create", "sale", sale.id, null, sale);

  if (packageType === "birebir") {
    await prisma.student.create({
      data: {
        studentName: customerNote.trim(),
        parentPhone: customerPhone || null,
        email: customerEmail || null,
        paymentAmount: String(totalPrice),
        status: "pending",
        totalLessons: 12,
        soldByName: user.name,
      },
    });
  }

  return Response.json(sale, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, unitPrice } = body;

  if (!id || !unitPrice || unitPrice <= 0) {
    return Response.json({ error: "Geçersiz veri" }, { status: 400 });
  }

  const existing = await prisma.sale.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Satış bulunamadı" }, { status: 404 });

  if (existing.userId !== user.id && user.role !== "admin") {
    return Response.json({ error: "Bu satışı düzenleme yetkiniz yok" }, { status: 403 });
  }

  const newTotal = unitPrice - existing.discount;

  const sale = await prisma.sale.update({
    where: { id },
    data: {
      unitPrice,
      totalPrice: newTotal,
    },
    include: {
      user: { select: { id: true, name: true, team: { select: { name: true, color: true } } } },
    },
  });

  await createAuditLog(user.id, "update", "sale", id, existing, { unitPrice, totalPrice: newTotal });

  return Response.json(sale);
}
