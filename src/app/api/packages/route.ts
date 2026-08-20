import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const packages = await prisma.package.findMany({
    where: { isActive: true },
    include: { product: true },
    orderBy: [{ product: { name: "asc" } }, { basePrice: "asc" }],
  });
  return Response.json(packages);
}
