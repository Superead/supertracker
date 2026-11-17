import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getOAuth2Client } from "@/lib/google";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/*
 * Ders davetlerinin hangi Google hesabından gittiğini gösterir (yalnız admin).
 * Davetler bilgi@superhizliokuma.com'dan gitsin isteniyorsa: o hesapla Google'a giriş yapıp
 * /api/auth/google/setup adresini açın, çıkan refresh_token'ı Railway'de GOOGLE_REFRESH_TOKEN yapın.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    return NextResponse.json({ connected: false, message: "Google Takvim bağlı değil" });
  }
  try {
    const calendar = google.calendar({ version: "v3", auth: getOAuth2Client() });
    const res = await calendar.events.list({ calendarId: "primary", maxResults: 1 });
    return NextResponse.json({
      connected: true,
      account: res.data.summary || null,
      notifyEmail: process.env.NOTIFY_EMAIL || null,
      message: `Ders davetleri ${res.data.summary || "bağlı hesap"} takviminden gönderiliyor.`,
    });
  } catch (e) {
    return NextResponse.json({ connected: false, error: e instanceof Error ? e.message : String(e) });
  }
}
