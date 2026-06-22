import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { compareSync } from "bcryptjs";
import { signToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    return Response.json({ error: "Geçersiz email veya şifre" }, { status: 401 });
  }

  const valid = compareSync(password, user.password);
  if (!valid) {
    return Response.json({ error: "Geçersiz email veya şifre" }, { status: 401 });
  }

  const token = signToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    teamId: user.teamId,
  });

  const response = Response.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role, teamId: user.teamId },
  });

  response.headers.set(
    "Set-Cookie",
    `token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
  );

  return response;
}
