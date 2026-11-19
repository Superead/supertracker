import { NextRequest } from "next/server";
import { hashSync } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/*
 * Satış müdürü hesapları (yalnız admin).
 * GET → müdürler
 * POST { action: "mudur", name, email, password } → rol: manager
 * POST { action: "mudur-durum", id, isActive }
 */
async function admin() {
  const u = await getCurrentUser();
  return u?.role === "admin" ? u : null;
}

export async function GET() {
  if (!(await admin())) return Response.json({ error: "Forbidden" }, { status: 403 });
  const mudurler = await prisma.user.findMany({
    where: { role: "manager" },
    select: { id: true, name: true, email: true, isActive: true },
    orderBy: { name: "asc" },
  });
  return Response.json({ mudurler });
}

export async function POST(request: NextRequest) {
  if (!(await admin())) return Response.json({ error: "Forbidden" }, { status: 403 });
  const b = await request.json();
  if (b.action === "mudur") {
    const email = String(b.email || "").trim().toLowerCase();
    const name = String(b.name || "").trim();
    if (!email || !name || String(b.password || "").length < 6) {
      return Response.json({ error: "Ad, e-posta ve en az 6 karakterli şifre gerekli" }, { status: 400 });
    }
    if (await prisma.user.findUnique({ where: { email } })) return Response.json({ error: "Bu e-posta zaten kullanılıyor" }, { status: 400 });
    const u = await prisma.user.create({
      data: { email, name, password: hashSync(String(b.password), 10), role: "manager" },
      select: { id: true, name: true, email: true, isActive: true },
    });
    return Response.json(u, { status: 201 });
  }
  if (b.action === "mudur-durum") {
    const u = await prisma.user.findUnique({ where: { id: String(b.id) } });
    if (u?.role !== "manager") return Response.json({ error: "Müdür bulunamadı" }, { status: 404 });
    const r = await prisma.user.update({ where: { id: u.id }, data: { isActive: !!b.isActive }, select: { id: true, name: true, email: true, isActive: true } });
    return Response.json(r);
  }
  return Response.json({ error: "Bilinmeyen işlem" }, { status: 400 });
}
