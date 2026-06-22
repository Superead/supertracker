import { prisma } from "@/lib/prisma";

export async function GET() {
  const packages = await prisma.package.findMany({
    where: { isActive: true },
    include: { product: true },
    orderBy: [{ product: { name: "asc" } }, { basePrice: "asc" }],
  });
  return Response.json(packages);
}
