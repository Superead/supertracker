import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hashSync } from "bcryptjs";

async function canManageEducation(userId: string, role: string): Promise<boolean> {
  if (role === "admin") return true;
  const educator = await prisma.educator.findUnique({ where: { userId } });
  return !!educator?.isInternal;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !(await canManageEducation(user.id, user.role))) return Response.json({ error: "Forbidden" }, { status: 403 });

  const educators = await prisma.educator.findMany({
    where: { isActive: true },
    include: {
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { students: { where: { isActive: true } } } },
    },
    orderBy: { name: "asc" },
  });

  return Response.json(educators);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(await canManageEducation(user.id, user.role))) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { name, phone, iban, email, password } = await request.json();
  if (!name) return Response.json({ error: "Eğitmen adı gerekli" }, { status: 400 });

  let linkedUserId: string | null = null;

  if (email && password) {
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return Response.json({ error: "Bu email adresi zaten kullanılıyor" }, { status: 400 });
    }
    const newUser = await prisma.user.create({
      data: { email: normalizedEmail, name, password: hashSync(password, 10), role: "educator" },
    });
    linkedUserId = newUser.id;
  }

  const educator = await prisma.educator.create({
    data: { name, phone: phone || null, iban: iban || null, userId: linkedUserId },
  });

  return Response.json(educator, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(await canManageEducation(user.id, user.role))) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { id, name, phone, iban } = body;
  const educator = await prisma.educator.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      phone: phone || null,
      iban: iban || null,
      // Only touch the user link when explicitly included in the request
      ...("userId" in body ? { userId: body.userId || null } : {}),
    },
  });

  return Response.json(educator);
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await request.json();
  await prisma.educator.update({ where: { id }, data: { isActive: false } });

  return Response.json({ success: true });
}
