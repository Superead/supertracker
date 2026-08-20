import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const KOMMO_TOKEN = process.env.KOMMO_TOKEN;
const KOMMO_SUBDOMAIN = process.env.KOMMO_SUBDOMAIN || "mehmettashanligil";
const PIPELINE_ID = process.env.KOMMO_PIPELINE_ID || "12058160";
const TURKEY_OFFSET_SEC = 3 * 3600;
const EXCLUDED_KOMMO_IDS = (process.env.KOMMO_EXCLUDED_IDS || "13905092,14604779,14604783,14604791")
  .split(",")
  .map((id) => parseInt(id.trim()));

async function kommoFetch(path: string) {
  if (!KOMMO_TOKEN) throw new Error("KOMMO_TOKEN not configured");
  const res = await fetch(`https://${KOMMO_SUBDOMAIN}.kommo.com/api/v4${path}`, {
    headers: { Authorization: `Bearer ${KOMMO_TOKEN}` },
    next: { revalidate: 0 },
  });
  if (res.status === 204) return { _embedded: { leads: [] }, _total_items: 0 };
  if (!res.ok) throw new Error(`Kommo API error: ${res.status}`);
  return res.json();
}

async function fetchLeads(fromTs: number, toTs: number) {
  const allLeads: Array<{ responsible_user_id: number; status_id: number; created_at: number }> = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const data = await kommoFetch(
      `/leads?filter[pipeline_id]=${PIPELINE_ID}&filter[created_at][from]=${fromTs}&filter[created_at][to]=${toTs}&limit=250&page=${page}`
    );
    const leads = data?._embedded?.leads || [];
    allLeads.push(...leads);
    hasMore = leads.length === 250;
    page++;
    if (page > 20) break;
  }
  return allLeads;
}

function turkeyMidnight(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month, day) / 1000) - TURKEY_OFFSET_SEC;
}

function turkeyEndOfDay(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month, day, 23, 59, 59) / 1000) - TURKEY_OFFSET_SEC;
}

function calcPerUser(
  leads: Array<{ responsible_user_id: number; status_id: number }>,
  users: Array<{ id: number; name: string }>,
  kommoToSt: Map<number, { id: string; name: string; teamId: string | null }>
) {
  const WON_STATUS = 142;
  return users.map((ku) => {
    const userLeads = leads.filter((l) => l.responsible_user_id === ku.id);
    const wonLeads = userLeads.filter((l) => l.status_id === WON_STATUS);
    const stUser = kommoToSt.get(ku.id);
    return {
      kommoUserId: ku.id,
      kommoUserName: ku.name,
      superTrackerUser: stUser ? { id: stUser.id, name: stUser.name } : null,
      totalLeads: userLeads.length,
      wonLeads: wonLeads.length,
      conversionRate: userLeads.length > 0 ? Math.round((wonLeads.length / userLeads.length) * 100) : 0,
    };
  });
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "educator") return Response.json({ error: "Forbidden" }, { status: 403 });

  const nowTR = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  const tYear = nowTR.getFullYear();
  const tMonth = nowTR.getMonth();
  const tDay = nowTR.getDate();

  const dayFromTs = turkeyMidnight(tYear, tMonth, tDay);
  const dayToTs = turkeyEndOfDay(tYear, tMonth, tDay);

  const monthParam = request.nextUrl.searchParams.get("month");
  let mYear = tYear;
  let mMonth = tMonth;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    mYear = y;
    mMonth = m - 1;
  }
  const lastDayOfMonth = new Date(mYear, mMonth + 1, 0).getDate();
  const monthFromTs = turkeyMidnight(mYear, mMonth, 1);
  const monthToTs = turkeyEndOfDay(mYear, mMonth, lastDayOfMonth);

  try {
    const [dailyLeads, monthlyLeads, kommoUsers] = await Promise.all([
      fetchLeads(dayFromTs, dayToTs),
      fetchLeads(monthFromTs, monthToTs),
      kommoFetch("/users"),
    ]);

    const users = (kommoUsers?._embedded?.users || []).filter(
      (u: { id: number }) => !EXCLUDED_KOMMO_IDS.includes(u.id)
    );

    const stUsers = await prisma.user.findMany({
      where: { isActive: true, kommoUserId: { not: null } },
      select: { id: true, name: true, kommoUserId: true, teamId: true },
    });

    const kommoToSt = new Map<number, { id: string; name: string; teamId: string | null }>();
    for (const u of stUsers) {
      if (u.kommoUserId) kommoToSt.set(u.kommoUserId, u);
    }

    const daily = calcPerUser(dailyLeads, users, kommoToSt);
    const monthly = calcPerUser(monthlyLeads, users, kommoToSt);

    return Response.json({
      daily: { perUser: daily, totalLeads: dailyLeads.length },
      monthly: { perUser: monthly, totalLeads: monthlyLeads.length },
      today: `${tYear}-${String(tMonth + 1).padStart(2, "0")}-${String(tDay).padStart(2, "0")}`,
      month: `${mYear}-${String(mMonth + 1).padStart(2, "0")}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
