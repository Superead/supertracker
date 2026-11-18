import { NextRequest } from "next/server";
import { randevuYetkisi, musaitlikHesapla, simdiTR } from "@/lib/randevu";

export const dynamic = "force-dynamic";

/* GET ?date=YYYY-MM-DD[&bas=HH:MM&son=HH:MM] → her hocanın boş başlangıç saatleri */
export async function GET(request: NextRequest) {
  const user = await randevuYetkisi();
  if (!user) return Response.json({ error: "Forbidden" }, { status: 403 });
  const p = request.nextUrl.searchParams;
  const date = p.get("date") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "Tarih gerekli" }, { status: 400 });
  if (date < simdiTR().tarih) return Response.json({ error: "Geçmiş bir güne randevu verilemez" }, { status: 400 });
  const t = (v: string | null) => (v && /^\d{2}:\d{2}$/.test(v) ? v : undefined);
  return Response.json(await musaitlikHesapla(date, { bas: t(p.get("bas")), son: t(p.get("son")) }));
}
