import { prisma } from "@/lib/prisma";

export async function GET() {
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
