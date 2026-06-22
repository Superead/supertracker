import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { compareSync, hashSync } from "bcryptjs";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { currentPassword, newPassword } = await request.json();

  if (!newPassword || newPassword.length < 6) {
    return Response.json({ error: "Şifre en az 6 karakter olmalı" }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser || !compareSync(currentPassword, dbUser.password)) {
    return Response.json({ error: "Mevcut şifre yanlış" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashSync(newPassword, 10) },
  });

  return Response.json({ success: true });
}
