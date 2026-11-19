import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { getCurrentUser } from "./auth";

/** Satış karnesini admin ve satış müdürü (role: manager) görür. */
export async function karneYetkisi() {
  const u = await getCurrentUser();
  return u && (u.role === "admin" || u.role === "manager") ? u : null;
}

/** Haftalık kalite raporunu gönderen zamanlanmış görev için anahtar (KARNE_ANAHTAR, ?anahtar= veya x-karne-anahtar). */
export function karneAnahtariDogruMu(req: NextRequest): boolean {
  const beklenen = process.env.KARNE_ANAHTAR || "";
  const gelen = req.headers.get("x-karne-anahtar") || req.nextUrl.searchParams.get("anahtar") || "";
  if (!beklenen || gelen.length !== beklenen.length) return false;
  return timingSafeEqual(Buffer.from(gelen), Buffer.from(beklenen));
}
