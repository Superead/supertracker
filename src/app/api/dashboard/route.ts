import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (user.role !== "admin") {
    if (user.role === "educator") return Response.json({ error: "Forbidden" }, { status: 403 });
    const educatorCheck = await prisma.educator.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (educatorCheck) return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const monthParam = request.nextUrl.searchParams.get("month");

  const pad = (n: number) => String(n).padStart(2, "0");
  const nowTR = new Date(Date.now() + 3 * 3600000);
  const trYear = nowTR.getUTCFullYear();
  const trMonth = nowTR.getUTCMonth();
  const trDay = nowTR.getUTCDate();
  let targetYear: number, targetMonth: number;

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    targetYear = y;
    targetMonth = m - 1;
  } else {
    targetYear = trYear;
    targetMonth = trMonth;
  }

  const isCurrentMonth = targetYear === trYear && targetMonth === trMonth;

  const todayStart = new Date(`${trYear}-${pad(trMonth + 1)}-${pad(trDay)}T00:00:00+03:00`);
  const todayEnd = new Date(`${trYear}-${pad(trMonth + 1)}-${pad(trDay)}T23:59:59+03:00`);
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const monthStart = new Date(`${targetYear}-${pad(targetMonth + 1)}-01T00:00:00+03:00`);
  const monthEnd = new Date(`${targetYear}-${pad(targetMonth + 1)}-${pad(lastDay)}T23:59:59+03:00`);

  const todayPeriod = `${trYear}-${pad(trMonth + 1)}-${pad(trDay)}`;
  const monthPeriod = `${targetYear}-${pad(targetMonth + 1)}`;

  const teams = await prisma.team.findMany({
    where: { isActive: true },
    include: {
      members: {
        where: { isActive: true },
        select: { id: true, name: true },
      },
    },
  });

  const todaySales = isCurrentMonth
    ? await prisma.sale.findMany({
        where: {
          isDeleted: false,
          createdAt: { gte: todayStart, lte: todayEnd },
        },
        include: {
          user: { select: { id: true, name: true, teamId: true, team: { select: { name: true, color: true } } } },
          package: { include: { product: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const monthSales = await prisma.sale.findMany({
    where: {
      isDeleted: false,
      createdAt: { gte: monthStart, lte: monthEnd },
    },
    include: {
      user: { select: { id: true, name: true, teamId: true, team: { select: { name: true, color: true } } } },
      package: { include: { product: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const bonusTiers = await prisma.bonusTier.findMany({
    where: { isActive: true },
    orderBy: { minAmount: "asc" },
  });

  const dailyGoals = await prisma.goal.findMany({
    where: { type: "daily", period: todayPeriod },
  });

  const monthlyGoals = await prisma.goal.findMany({
    where: { type: "monthly", period: monthPeriod },
  });

  const globalDailyGoal = dailyGoals.find((g) => g.isGlobal);
  const globalMonthlyGoal = monthlyGoals.find((g) => g.isGlobal);

  const announcements = await prisma.announcement.findMany({
    where: {
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // Team stats
  const teamStats = teams.map((team) => {
    const memberIds = team.members.map((m) => m.id);
    const teamTodaySales = todaySales.filter((s) => memberIds.includes(s.userId));
    const teamMonthSales = monthSales.filter((s) => memberIds.includes(s.userId));
    const todayTotal = teamTodaySales.reduce((sum, s) => sum + s.totalPrice, 0);
    const monthTotal = teamMonthSales.reduce((sum, s) => sum + s.totalPrice, 0);
    const todaySaleCount = teamTodaySales.length;
    const monthSaleCount = teamMonthSales.length;

    const teamDailyGoal = dailyGoals.find((g) => g.teamId === team.id);
    const teamMonthlyGoal = monthlyGoals.find((g) => g.teamId === team.id);

    // Bonus calculation
    let dailyBonus = 0;
    for (const tier of bonusTiers) {
      if (todayTotal >= tier.minAmount) {
        dailyBonus = tier.bonusAmount;
      }
    }

    return {
      team: { id: team.id, name: team.name, color: team.color },
      members: team.members,
      todayTotal,
      monthTotal,
      todaySaleCount,
      monthSaleCount,
      dailyBonus,
      dailyGoal: teamDailyGoal?.target || (globalDailyGoal?.target ? Math.round(globalDailyGoal.target / teams.length) : 0),
      monthlyGoal: teamMonthlyGoal?.target || (globalMonthlyGoal?.target ? Math.round(globalMonthlyGoal.target / teams.length) : 0),
    };
  });

  const overallTodayTotal = todaySales.reduce((sum, s) => sum + s.totalPrice, 0);
  const overallMonthTotal = monthSales.reduce((sum, s) => sum + s.totalPrice, 0);

  // Refunds for the month
  const monthRefunds = await prisma.refund.findMany({
    where: { createdAt: { gte: monthStart, lte: monthEnd } },
    include: {
      user: { select: { id: true, name: true, teamId: true, team: { select: { name: true, color: true } } } },
    },
  });
  const totalRefunds = monthRefunds.reduce((sum, r) => sum + r.amount, 0);

  // Type breakdowns
  const educatorSales = monthSales.filter((s) => s.packageType === "instructor" || s.packageType === "educator");
  const individualSales = monthSales.filter((s) => s.packageType === "individual");
  const educatorTotal = educatorSales.reduce((sum, s) => sum + s.totalPrice, 0);
  const individualTotal = individualSales.reduce((sum, s) => sum + s.totalPrice, 0);

  const todayEducatorSales = todaySales.filter((s) => s.packageType === "instructor" || s.packageType === "educator");
  const todayIndividualSales = todaySales.filter((s) => s.packageType === "individual");
  const todayEducatorTotal = todayEducatorSales.reduce((sum, s) => sum + s.totalPrice, 0);
  const todayIndividualTotal = todayIndividualSales.reduce((sum, s) => sum + s.totalPrice, 0);

  // Per-user refund map for team stats
  const userRefundMap: Record<string, number> = {};
  for (const r of monthRefunds) {
    userRefundMap[r.userId] = (userRefundMap[r.userId] || 0) + r.amount;
  }

  // Add refund info to team stats
  const teamStatsWithRefunds = teamStats.map((ts) => {
    const memberIds = ts.members.map((m: { id: string }) => m.id);
    const teamRefunds = memberIds.reduce((sum: number, id: string) => sum + (userRefundMap[id] || 0), 0);
    return { ...ts, refundTotal: teamRefunds, netMonthTotal: ts.monthTotal - teamRefunds };
  });

  const todayMMDD = `${pad(trMonth + 1)}-${pad(trDay)}`;
  const allUsers = await prisma.user.findMany({
    where: { isActive: true, birthday: { not: null } },
    select: { name: true, birthday: true, team: { select: { name: true, color: true } } },
  });
  const birthdayUsers = allUsers.filter(u => u.birthday && u.birthday.slice(5) === todayMMDD);

  return Response.json({
    teamStats: teamStatsWithRefunds,
    birthdayUsers,
    todaySales: todaySales.slice(0, 20),
    monthSales,
    overallTodayTotal,
    overallMonthTotal,
    netMonthTotal: overallMonthTotal - totalRefunds,
    totalRefunds,
    educatorTotal,
    individualTotal,
    todayEducatorTotal,
    todayIndividualTotal,
    educatorSaleCount: educatorSales.length,
    individualSaleCount: individualSales.length,
    globalDailyGoal: globalDailyGoal?.target || 0,
    globalMonthlyGoal: globalMonthlyGoal?.target || 0,
    bonusTiers,
    announcements,
    monthRefunds,
    selectedMonth: monthPeriod,
    isCurrentMonth,
  });
}
