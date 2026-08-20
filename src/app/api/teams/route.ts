import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "educator") return Response.json({ error: "Forbidden" }, { status: 403 });

  const teams = await prisma.team.findMany({
    where: { isActive: true },
    include: {
      members: {
        where: { isActive: true },
        select: { id: true, name: true, email: true },
      },
    },
  });
  return Response.json(teams);
}
