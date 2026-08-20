import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const educator = await prisma.educator.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  return Response.json({ user: { ...user, isEducator: !!educator } });
}
