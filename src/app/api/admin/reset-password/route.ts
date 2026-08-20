import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hashSync } from "bcryptjs";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId, newPassword } = await request.json();
  if (!userId || !newPassword || newPassword.length < 4) {
    return Response.json({ error: "Geçersiz şifre (min 4 karakter)" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashSync(newPassword, 10) },
  });

  return Response.json({ success: true });
}
