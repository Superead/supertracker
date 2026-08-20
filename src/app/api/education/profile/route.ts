import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Educator updates their own phone/iban
export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const educator = await prisma.educator.findUnique({ where: { userId: user.id } });
  if (!educator) return Response.json({ error: "Eğitmen kaydı bulunamadı" }, { status: 404 });

  const { phone, iban } = await request.json();

  const updated = await prisma.educator.update({
    where: { id: educator.id },
    data: {
      phone: phone || null,
      iban: iban || null,
    },
  });

  return Response.json(updated);
}
