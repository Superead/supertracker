import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { karneYetkisi } from "@/lib/karne-yetki";

export const dynamic = "force-dynamic";

/*
 * Koçluk görevleri (admin + satış müdürü).
 * POST  { kommoUserId, grup, metin, hedefTarih? }  → yeni görev
 * PATCH { id, durum?: "acik"|"tamam", metin?, hedefTarih? }
 * DELETE ?id=
 */
export async function POST(request: NextRequest) {
  const u = await karneYetkisi();
  if (!u) return Response.json({ error: "Forbidden" }, { status: 403 });
  const b = await request.json();
  const metin = String(b.metin || "").trim();
  if (!metin || !Number(b.kommoUserId)) return Response.json({ error: "Grup ve görev metni gerekli" }, { status: 400 });
  const hedef = /^\d{4}-\d{2}-\d{2}$/.test(String(b.hedefTarih || "")) ? String(b.hedefTarih) : null;
  const n = await prisma.koclukNotu.create({
    data: { kommoUserId: Number(b.kommoUserId), grup: String(b.grup || ""), metin, hedefTarih: hedef, olusturan: u.name },
  });
  return Response.json(n, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  if (!(await karneYetkisi())) return Response.json({ error: "Forbidden" }, { status: 403 });
  const b = await request.json();
  const data: { durum?: string; tamamlandi?: Date | null; metin?: string; hedefTarih?: string | null } = {};
  if (b.durum === "tamam" || b.durum === "acik") {
    data.durum = b.durum;
    data.tamamlandi = b.durum === "tamam" ? new Date() : null;
  }
  if (typeof b.metin === "string" && b.metin.trim()) data.metin = b.metin.trim();
  if (b.hedefTarih !== undefined) data.hedefTarih = /^\d{4}-\d{2}-\d{2}$/.test(String(b.hedefTarih || "")) ? String(b.hedefTarih) : null;
  const n = await prisma.koclukNotu.update({ where: { id: String(b.id) }, data });
  return Response.json(n);
}

export async function DELETE(request: NextRequest) {
  if (!(await karneYetkisi())) return Response.json({ error: "Forbidden" }, { status: 403 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "id gerekli" }, { status: 400 });
  await prisma.koclukNotu.delete({ where: { id } });
  return Response.json({ ok: true });
}
