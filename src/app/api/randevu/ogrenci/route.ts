import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { kommo, trTelefon } from "@/lib/ders-hatirlatma";
import { randevuYetkisi } from "@/lib/randevu";

export const dynamic = "force-dynamic";

type Kisi = { id: number; name: string; custom_fields_values?: { field_code?: string; values: { value: string }[] }[] | null };

/* GET ?phone=… → Kommo'daki kişi (ad, e-posta) ve öğrencinin önceki randevuları */
export async function GET(request: NextRequest) {
  const user = await randevuYetkisi();
  if (!user) return Response.json({ error: "Forbidden" }, { status: 403 });
  const tel = trTelefon(request.nextUrl.searchParams.get("phone"));
  if (!tel) return Response.json({ error: "Geçerli bir telefon numarası girin" }, { status: 400 });

  let kisi: { name: string; email: string | null } | null = null;
  try {
    const son10 = tel.slice(-10);
    const r = await kommo<{ _embedded: { contacts: Kisi[] } }>("GET", `/contacts?query=${son10}&limit=50`);
    const k = (r?._embedded.contacts ?? []).find((c) =>
      (c.custom_fields_values || []).some(
        (f) => f.field_code === "PHONE" && f.values.some((v) => (v.value || "").replace(/\D/g, "").endsWith(son10)),
      ),
    );
    if (k) {
      const email = (k.custom_fields_values || []).find((f) => f.field_code === "EMAIL")?.values[0]?.value || null;
      kisi = { name: k.name, email };
    }
  } catch {
    // Kommo'ya ulaşılamazsa sadece randevu geçmişini göster.
  }

  const gecmis = await prisma.appointment.findMany({
    where: { phone: tel },
    include: { calendar: { select: { teacherName: true } } },
    orderBy: [{ date: "desc" }, { time: "desc" }],
    take: 10,
  });
  return Response.json({ phone: tel, kisi, gecmis });
}
