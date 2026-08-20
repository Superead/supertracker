import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashSync } from "bcryptjs";

export async function POST(request: NextRequest) {
  const { name, email, password, phone, iban } = await request.json();

  if (!name || !email || !password) {
    return Response.json({ error: "Ad, email ve şifre zorunludur" }, { status: 400 });
  }
  if (password.length < 6) {
    return Response.json({ error: "Şifre en az 6 karakter olmalı" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (existing) {
    return Response.json({ error: "Bu email adresi zaten kayıtlı" }, { status: 400 });
  }

  const newUser = await prisma.user.create({
    data: {
      email: email.toLowerCase().trim(),
      name,
      password: hashSync(password, 10),
      role: "educator",
    },
  });

  await prisma.educator.create({
    data: {
      name,
      phone: phone || null,
      iban: iban || null,
      userId: newUser.id,
      isInternal: false,
      isActive: true,
    },
  });

  return Response.json({ success: true }, { status: 201 });
}
