import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const KOMMO_TOKEN = process.env.KOMMO_TOKEN;
const KOMMO_SUBDOMAIN = process.env.KOMMO_SUBDOMAIN || "mehmettashanligil";
const PIPELINE_ID = process.env.KOMMO_PIPELINE_ID || "12058160";
const TURKEY_OFFSET_SEC = 3 * 3600;

const MORNING_MINUTE = 9 * 60 + 30;  // 09:30
const EVENING_MINUTE = 18 * 60 + 30; // 18:30

// Channels that are not new leads. 165365 is the WhatsApp support line
// (waba:1262349336963234), live since 18 August — people writing in for
// help on an existing purchase, not prospects.
const EXCLUDED_SOURCE_IDS = (process.env.KOMMO_EXCLUDED_SOURCE_IDS || "165365")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function canAccess(role: string) {
  return role === "admin";
}

async function kommoFetch(path: string) {
  if (!KOMMO_TOKEN) throw new Error("KOMMO_TOKEN not configured");
  const res = await fetch(`https://${KOMMO_SUBDOMAIN}.kommo.com/api/v4${path}`, {
    headers: { Authorization: `Bearer ${KOMMO_TOKEN}` },
    next: { revalidate: 0 },
  });
  if (res.status === 204) return { _embedded: { leads: [] } };
  if (!res.ok) throw new Error(`Kommo API error: ${res.status}`);
  return res.json();
}

/**
 * Counts leads per day at the two daily checkpoints, in Turkish time.
 * Both counts are cumulative from midnight, matching how the team records them.
 */
async function fetchKommoDailyCounts(year: number, month: number) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const fromTs = Math.floor(Date.UTC(year, month - 1, 1, 0, 0, 0) / 1000) - TURKEY_OFFSET_SEC;
  const toTs = Math.floor(Date.UTC(year, month - 1, lastDay, 23, 59, 59) / 1000) - TURKEY_OFFSET_SEC;

  const counts: Record<string, { morning: number; evening: number; allDay: number; excluded: number }> = {};

  let page = 1;
  while (page <= 60) {
    // with=source_id is required — the field is omitted from the default response
    const data = await kommoFetch(
      `/leads?filter[pipeline_id]=${PIPELINE_ID}&filter[created_at][from]=${fromTs}&filter[created_at][to]=${toTs}&limit=250&page=${page}&with=source_id`
    );
    const leads: Array<{ created_at: number; source_id?: number }> = data?._embedded?.leads || [];

    for (const lead of leads) {
      // Shift into Turkish time so the UTC getters read as local wall-clock values
      const tr = new Date((lead.created_at + TURKEY_OFFSET_SEC) * 1000);
      const day = String(tr.getUTCDate()).padStart(2, "0");
      const key = `${year}-${String(month).padStart(2, "0")}-${day}`;
      const minuteOfDay = tr.getUTCHours() * 60 + tr.getUTCMinutes();

      if (!counts[key]) counts[key] = { morning: 0, evening: 0, allDay: 0, excluded: 0 };

      if (EXCLUDED_SOURCE_IDS.includes(String(lead.source_id))) {
        counts[key].excluded++;
        continue;
      }

      counts[key].allDay++;
      if (minuteOfDay <= EVENING_MINUTE) counts[key].evening++;
      if (minuteOfDay <= MORNING_MINUTE) counts[key].morning++;
    }

    if (leads.length < 250) break;
    page++;
  }

  return counts;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccess(user.role)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const monthParam = request.nextUrl.searchParams.get("month");
  const now = new Date(Date.now() + TURKEY_OFFSET_SEC * 1000);
  const year = monthParam ? Number(monthParam.split("-")[0]) : now.getUTCFullYear();
  const month = monthParam ? Number(monthParam.split("-")[1]) : now.getUTCMonth() + 1;
  const monthStr = `${year}-${String(month).padStart(2, "0")}`;

  const agents = await prisma.user.findMany({
    where: { role: "agent", isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const [overrides, durations] = await Promise.all([
    prisma.dailyMetric.findMany({ where: { date: { startsWith: monthStr } } }),
    prisma.callDuration.findMany({ where: { date: { startsWith: monthStr } } }),
  ]);

  let kommo: Record<string, { morning: number; evening: number; allDay: number; excluded: number }> = {};
  let kommoError: string | null = null;
  try {
    kommo = await fetchKommoDailyCounts(year, month);
  } catch (e) {
    kommoError = e instanceof Error ? e.message : "Kommo verisi alınamadı";
  }

  const overrideMap = new Map(overrides.map((o) => [o.date, o]));
  const durationMap = new Map(durations.map((d) => [`${d.date}|${d.userId}`, d]));

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;

  const days = [];
  for (let d = 1; d <= lastDay; d++) {
    const date = `${monthStr}-${String(d).padStart(2, "0")}`;
    if (date > todayStr) continue;

    const auto = kommo[date] || { morning: 0, evening: 0, allDay: 0, excluded: 0 };
    const ov = overrideMap.get(date);

    const morning = ov?.morningCount ?? auto.morning;
    const evening = ov?.eveningCount ?? auto.evening;
    const teamSize = ov?.teamSize ?? agents.length;

    days.push({
      date,
      morning,
      evening,
      allDay: auto.allDay,
      teamSize,
      teamAvg: teamSize > 0 ? Math.round(evening / teamSize) : 0,
      isMorningManual: ov?.morningCount != null,
      isEveningManual: ov?.eveningCount != null,
      autoMorning: auto.morning,
      autoEvening: auto.evening,
      excludedCount: auto.excluded,
      note: ov?.note || null,
      calls: agents.map((a) => {
        const cd = durationMap.get(`${date}|${a.id}`);
        return {
          userId: a.id,
          name: a.name,
          minutes: cd?.minutes ?? null,
          isOnLeave: cd?.isOnLeave ?? false,
        };
      }),
    });
  }

  days.reverse(); // newest first

  // Month summary — leave days are excluded from call averages
  const workedCalls = durations.filter((d) => !d.isOnLeave && d.minutes != null);
  const perAgent = agents.map((a) => {
    const mine = workedCalls.filter((d) => d.userId === a.id);
    const total = mine.reduce((s, d) => s + (d.minutes || 0), 0);
    return {
      userId: a.id,
      name: a.name,
      totalMinutes: total,
      dayCount: mine.length,
      avgMinutes: mine.length > 0 ? Math.round(total / mine.length) : 0,
    };
  }).sort((a, b) => b.totalMinutes - a.totalMinutes);

  const daysWithEvening = days.filter((d) => d.evening > 0);

  return Response.json({
    month: monthStr,
    days,
    agents,
    perAgent,
    summary: {
      avgEvening: daysWithEvening.length > 0
        ? Math.round(daysWithEvening.reduce((s, d) => s + d.evening, 0) / daysWithEvening.length)
        : 0,
      avgTeamAvg: daysWithEvening.length > 0
        ? Math.round(daysWithEvening.reduce((s, d) => s + d.teamAvg, 0) / daysWithEvening.length)
        : 0,
      totalLeads: days.reduce((s, d) => s + d.allDay, 0),
    },
    kommoError,
  });
}

// Manual override of a day's lead counts
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccess(user.role)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { date, morningCount, eveningCount, teamSize, note } = await request.json();
  if (!date) return Response.json({ error: "date gerekli" }, { status: 400 });

  const data = {
    morningCount: morningCount === null || morningCount === "" ? null : Number(morningCount),
    eveningCount: eveningCount === null || eveningCount === "" ? null : Number(eveningCount),
    teamSize: teamSize === null || teamSize === "" ? null : Number(teamSize),
    note: note || null,
  };

  const metric = await prisma.dailyMetric.upsert({
    where: { date },
    update: data,
    create: { date, ...data },
  });

  return Response.json(metric);
}

// Call duration for one agent on one day
export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccess(user.role)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { date, userId, minutes, isOnLeave } = await request.json();
  if (!date || !userId) return Response.json({ error: "date ve userId gerekli" }, { status: 400 });

  const data = {
    minutes: isOnLeave || minutes === null || minutes === "" ? null : Number(minutes),
    isOnLeave: !!isOnLeave,
  };

  const record = await prisma.callDuration.upsert({
    where: { date_userId: { date, userId } },
    update: data,
    create: { date, userId, ...data },
  });

  return Response.json(record);
}
