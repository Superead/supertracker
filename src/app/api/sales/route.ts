import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, createAuditLog } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = request.nextUrl;
  const date = url.searchParams.get("date");
  const month = url.searchParams.get("month");
  const userId = url.searchParams.get("userId");
  const teamId = url.searchParams.get("teamId");

  const where: Record<string, unknown> = { isDeleted: false };

  const TZ = "Europe/Istanbul";
  if (date) {
    const start = new Date(new Date(date + "T00:00:00").toLocaleString("en-US", { timeZone: TZ }));
    const end = new Date(new Date(date + "T23:59:59").toLocaleString("en-US", { timeZone: TZ }));
    where.createdAt = { gte: start, lte: end };
  } else if (month) {
    const [y, m] = month.split("-").map(Number);
    const start = new Date(new Date(y, m - 1, 1).toLocaleString("en-US", { timeZone: TZ }));
    const end = new Date(new Date(y, m, 0, 23, 59, 59).toLocaleString("en-US", { timeZone: TZ }));
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

  const body = await request.json();
  const { personCount, duration, packageType, unitPrice, discount, discountReason, customerType, customerNote, isBackdated, backdatedNote } = body;

  if (!unitPrice || unitPrice <= 0) {
    return Response.json({ error: "Fiyat girilmelidir" }, { status: 400 });
  }

  if (isBackdated && (!backdatedNote || backdatedNote.trim().length < 3)) {
    return Response.json({ error: "Düne satış girişi için açıklama zorunludur" }, { status: 400 });
  }

  const price = unitPrice;
  const discountAmount = discount || 0;
  const totalPrice = price - discountAmount;

  const TZ = "Europe/Istanbul";
  const nowTR = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  let createdAt: Date | undefined;
  if (isBackdated) {
    const yesterday = new Date(nowTR);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 0, 0);
    createdAt = yesterday;
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
