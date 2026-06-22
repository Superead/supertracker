import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const refunds = await prisma.refund.findMany({
    where: {
      userId: user.id,
      createdAt: { gte: monthStart, lte: monthEnd },
    },
    select: { id: true, amount: true, reason: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(refunds);
}
