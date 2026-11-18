import { NextRequest } from "next/server";
import { hashSync } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getCalendarName } from "@/lib/google";

export const dynamic = "force-dynamic";

/*
 * Randevu ayarları (yalnız admin).
 * GET                                                   → hoca takvimleri + destek kullanıcıları
 * POST { action: "takvim", calendarId, teacherName, teacherEmail?, meetLink? } → hoca takvimi ekler (Google'dan adı doğrulanır)
 * POST { action: "takvim-guncelle", id, teacherName?, teacherEmail?, meetLink?, isActive? }
 * POST { action: "kullanici", name, email, password }  → destek kullanıcısı açar (rol: support)
 * POST { action: "kullanici-durum", id, isActive }
 */

/** "https://meet.google.com/abc-defg-hij?pli=1" → "https://meet.google.com/abc-defg-hij" */
function temizMeet(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  const t = String(v || "").trim();
  if (!t) return null;
  const m = t.match(/meet\.google\.com\/([a-z]{3,4}-[a-z]{4}-[a-z]{3,4})/i);
  if (!m) throw new Error("Geçerli bir Google Meet linki girin (meet.google.com/xxx-xxxx-xxx)");
  return `https://meet.google.com/${m[1].toLowerCase()}`;
}

async function admin() {
  const user = await getCurrentUser();
  return user?.role === "admin" ? user : null;
}

export async function GET() {
  if (!(await admin())) return Response.json({ error: "Forbidden" }, { status: 403 });
  const takvimler = await prisma.appointmentCalendar.findMany({ orderBy: { teacherName: "asc" } });
  const kullanicilar = await prisma.user.findMany({
    where: { role: "support" },
    select: { id: true, name: true, email: true, isActive: true },
    orderBy: { name: "asc" },
  });
  return Response.json({ takvimler, kullanicilar });
}

export async function POST(request: NextRequest) {
  if (!(await admin())) return Response.json({ error: "Forbidden" }, { status: 403 });
  const b = await request.json();
  let meetLink: string | null | undefined;
  try {
    meetLink = temizMeet(b.meetLink);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }

  if (b.action === "takvim") {
    const calendarId = String(b.calendarId || "").trim();
    let teacherName = String(b.teacherName || "").trim();
    if (!calendarId) return Response.json({ error: "Takvim kimliği gerekli" }, { status: 400 });
    let calendarName: string | null;
    try {
      calendarName = await getCalendarName(calendarId);
    } catch (e) {
      return Response.json(
        { error: "Bu takvime erişilemedi. bilgi@ hesabının takvimde düzenleme yetkisi olduğundan emin olun. (" + (e instanceof Error ? e.message : String(e)) + ")" },
        { status: 400 },
      );
    }
    // Hoca adı girilmediyse takvim adının ilk kelimesi ("Buse Kaynak Randevu Takvimi" → "Buse").
    if (!teacherName) teacherName = (calendarName || "").split(/\s+/)[0] || "Hoca";
    const t = await prisma.appointmentCalendar.upsert({
      where: { calendarId },
      create: { calendarId, teacherName, teacherEmail: String(b.teacherEmail || "").trim().toLowerCase() || null, calendarName, meetLink: meetLink ?? null },
      update: { teacherName, teacherEmail: String(b.teacherEmail || "").trim().toLowerCase() || null, calendarName, isActive: true, ...(meetLink !== undefined ? { meetLink } : {}) },
    });
    return Response.json(t, { status: 201 });
  }

  if (b.action === "takvim-guncelle") {
    const t = await prisma.appointmentCalendar.update({
      where: { id: b.id },
      data: {
        ...(b.teacherName !== undefined ? { teacherName: String(b.teacherName).trim() } : {}),
        ...(b.teacherEmail !== undefined ? { teacherEmail: String(b.teacherEmail).trim().toLowerCase() || null } : {}),
        ...(b.isActive !== undefined ? { isActive: !!b.isActive } : {}),
        ...(meetLink !== undefined ? { meetLink } : {}),
      },
    });
    return Response.json(t);
  }

  if (b.action === "kullanici") {
    const email = String(b.email || "").trim().toLowerCase();
    const name = String(b.name || "").trim();
    if (!email || !name || String(b.password || "").length < 6) {
      return Response.json({ error: "Ad, e-posta ve en az 6 karakterli şifre gerekli" }, { status: 400 });
    }
    if (await prisma.user.findUnique({ where: { email } })) {
      return Response.json({ error: "Bu e-posta zaten kullanılıyor" }, { status: 400 });
    }
    const u = await prisma.user.create({
      data: { email, name, password: hashSync(String(b.password), 10), role: "support" },
      select: { id: true, name: true, email: true, isActive: true },
    });
    return Response.json(u, { status: 201 });
  }

  if (b.action === "kullanici-durum") {
    const u = await prisma.user.findUnique({ where: { id: b.id } });
    if (u?.role !== "support") return Response.json({ error: "Destek kullanıcısı bulunamadı" }, { status: 404 });
    const updated = await prisma.user.update({
      where: { id: b.id },
      data: { isActive: !!b.isActive },
      select: { id: true, name: true, email: true, isActive: true },
    });
    return Response.json(updated);
  }

  return Response.json({ error: "Bilinmeyen işlem" }, { status: 400 });
}
