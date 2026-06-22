"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface TeamStat {
  team: { id: string; name: string; color: string };
  members: { id: string; name: string }[];
  todayTotal: number;
  monthTotal: number;
  todaySaleCount: number;
  monthSaleCount: number;
  dailyBonus: number;
  dailyGoal: number;
  monthlyGoal: number;
}

interface SaleItem {
  id: string;
  totalPrice: number;
  personCount: number;
  duration: string;
  packageType: string;
  createdAt: string;
  user: { name: string; team: { name: string; color: string } | null };
  package: { name: string; product: { name: string } } | null;
}

const DURATION_LABELS: Record<string, string> = {
  monthly: "Aylık",
  "3month": "3 Aylık",
  yearly: "Yıllık",
  lifetime: "Ömür Boyu",
};

const TYPE_LABELS: Record<string, string> = {
  individual: "Bireysel",
  educator: "Eğitmen",
  instructor: "Eğitmen",
};

interface BonusTier {
  minAmount: number;
  bonusAmount: number;
}

interface DashboardData {
  teamStats: TeamStat[];
  todaySales: SaleItem[];
  overallTodayTotal: number;
  overallMonthTotal: number;
  netMonthTotal: number;
  totalRefunds: number;
  educatorTotal: number;
  individualTotal: number;
  todayEducatorTotal: number;
  todayIndividualTotal: number;
  educatorSaleCount: number;
  individualSaleCount: number;
  globalDailyGoal: number;
  globalMonthlyGoal: number;
  bonusTiers: BonusTier[];
  announcements: { title: string; message: string; type: string }[];
}

function formatTL(n: number) {
  return new Intl.NumberFormat("tr-TR").format(n);
}

function ProgressRing({ percent, color, size = 120 }: { percent: number; color: string; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(percent, 100) / 100) * circ;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.1)" strokeWidth="10" fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth="10"
        fill="none"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s ease-in-out" }}
      />
    </svg>
  );
}

function TeamCard({ stat, rank }: { stat: TeamStat; rank: number }) {
  const dailyPercent = stat.dailyGoal > 0 ? (stat.todayTotal / stat.dailyGoal) * 100 : 0;
  const monthPercent = stat.monthlyGoal > 0 ? (stat.monthTotal / stat.monthlyGoal) * 100 : 0;
  const goalReached = dailyPercent >= 100;
  const monthGoalReached = monthPercent >= 100;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-all duration-500 ${
        goalReached
          ? "bg-gradient-to-br from-green-900/40 to-emerald-900/40 border-green-500/50 shadow-lg shadow-green-500/20"
          : "bg-white/5 border-white/10"
      }`}
      style={goalReached ? { boxShadow: `0 0 30px ${stat.team.color}33` } : {}}
    >
      {/* Rank Badge */}
      <div className="absolute top-3 right-3">
        <span className={`text-2xl ${rank === 0 ? "" : rank === 1 ? "" : rank === 2 ? "" : ""}`}>
          {rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : `#${rank + 1}`}
        </span>
      </div>

      {goalReached && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 via-emerald-400 to-green-400 animate-pulse" />
        </div>
      )}

      <div className="p-5">
        {/* Team Name */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: stat.team.color }} />
          <h3 className="text-lg font-bold text-white">{stat.team.name}</h3>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Bugün</p>
            <p className={`text-2xl font-bold ${goalReached ? "text-green-400" : "text-white"}`}>
              {formatTL(stat.todayTotal)} ₺
            </p>
            <p className="text-xs text-slate-500">{stat.todaySaleCount} satış</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Bu Ay</p>
            <p className={`text-2xl font-bold ${monthGoalReached ? "text-green-400" : "text-white"}`}>
              {formatTL(stat.monthTotal)} ₺
            </p>
            <p className="text-xs text-slate-500">{stat.monthSaleCount} satış</p>
          </div>
        </div>

        {/* Daily Goal Bar */}
        {stat.dailyGoal > 0 && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Günlük Hedef</span>
              <span>{formatTL(stat.dailyGoal)} ₺</span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  goalReached ? "bg-gradient-to-r from-green-500 to-emerald-400" : "bg-gradient-to-r from-purple-500 to-pink-500"
                }`}
                style={{ width: `${Math.min(dailyPercent, 100)}%` }}
              />
            </div>
            <p className="text-right text-xs mt-1" style={{ color: goalReached ? "#4ade80" : stat.team.color }}>
              %{Math.round(dailyPercent)}
            </p>
          </div>
        )}

        {/* Monthly Goal Bar */}
        {stat.monthlyGoal > 0 && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Aylık Hedef</span>
              <span>{formatTL(stat.monthlyGoal)} ₺</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-blue-500 to-cyan-400"
                style={{ width: `${Math.min(monthPercent, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Bonus */}
        {stat.dailyBonus > 0 && (
          <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-yellow-300 text-sm">💰 Günlük Prim</span>
              <span className="text-yellow-400 font-bold">{formatTL(stat.dailyBonus)} ₺</span>
            </div>
            {stat.members.length > 1 && (
              <p className="text-xs text-yellow-300/60 mt-1 text-right">
                Kişi başı: {formatTL(Math.round(stat.dailyBonus / stat.members.length))} ₺
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [time, setTime] = useState(new Date());
  const confettiTriggered = useRef(false);

  const loadData = useCallback(async () => {
    const res = await fetch("/api/dashboard");
    if (res.ok) {
      const d = await res.json();
      setData(d);

      if (d.globalMonthlyGoal > 0 && d.overallMonthTotal >= d.globalMonthlyGoal && !confettiTriggered.current) {
        confettiTriggered.current = true;
        triggerConfetti();
      }
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    const clockInterval = setInterval(() => setTime(new Date()), 1000);
    return () => {
      clearInterval(interval);
      clearInterval(clockInterval);
    };
  }, [loadData]);

  async function triggerConfetti() {
    const confetti = (await import("canvas-confetti")).default;
    const duration = 5000;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ["#6c5ce7", "#e17055", "#00b894", "#fdcb6e"] });
      confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ["#6c5ce7", "#e17055", "#00b894", "#fdcb6e"] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">⚡</div>
          <p className="text-purple-300 text-xl">Dashboard yükleniyor...</p>
        </div>
      </div>
    );
  }

  const sorted = [...data.teamStats].sort((a, b) => b.todayTotal - a.todayTotal);
  const overallDailyPercent = data.globalDailyGoal > 0 ? (data.overallTodayTotal / data.globalDailyGoal) * 100 : 0;
  const overallMonthPercent = data.globalMonthlyGoal > 0 ? (data.overallMonthTotal / data.globalMonthlyGoal) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/50 to-slate-900 text-white">
      {/* Top Bar */}
      <header className="bg-black/30 backdrop-blur-lg border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              ⚡ SuperTracker
            </h1>
            {data.announcements.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 px-3 py-1 rounded-full text-yellow-300 text-sm animate-pulse">
                📢 {data.announcements[0].message}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-3xl font-mono text-purple-300">
              {time.toLocaleTimeString("tr-TR")}
            </div>
            <div className="text-sm text-slate-400">
              {time.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Overall Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-2xl p-5 text-center">
            <p className="text-sm text-purple-300">Bugün Genel</p>
            <p className="text-3xl font-bold mt-1">{formatTL(data.overallTodayTotal)} ₺</p>
          </div>
          <div className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border border-blue-500/30 rounded-2xl p-5 text-center">
            <p className="text-sm text-blue-300">Bu Ay Genel</p>
            <p className="text-3xl font-bold mt-1">{formatTL(data.overallMonthTotal)} ₺</p>
          </div>
          <div className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 border border-green-500/30 rounded-2xl p-5 text-center relative overflow-hidden">
            <p className="text-sm text-green-300">Günlük Hedef</p>
            <div className="relative flex items-center justify-center mt-2">
              <ProgressRing percent={overallDailyPercent} color="#22c55e" size={80} />
              <span className="absolute text-lg font-bold">{Math.round(overallDailyPercent)}%</span>
            </div>
          </div>
          <div className="bg-gradient-to-br from-orange-600/20 to-yellow-600/20 border border-orange-500/30 rounded-2xl p-5 text-center relative overflow-hidden">
            <p className="text-sm text-orange-300">Aylık Hedef</p>
            <div className="relative flex items-center justify-center mt-2">
              <ProgressRing percent={overallMonthPercent} color="#f59e0b" size={80} />
              <span className="absolute text-lg font-bold">{Math.round(overallMonthPercent)}%</span>
            </div>
          </div>
        </div>

        {/* Revenue by Type */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-amber-600/20 to-orange-600/20 border border-amber-500/30 rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute top-3 right-3 text-4xl opacity-20">👩‍🏫</div>
            <p className="text-sm text-amber-300 font-medium">Eğitici Cirosu</p>
            <p className="text-3xl font-bold text-white mt-2">{formatTL(data.educatorTotal)} ₺</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-amber-400/70">{data.educatorSaleCount} satış</span>
              <span className="text-xs text-amber-400/70">Bugün: {formatTL(data.todayEducatorTotal)} ₺</span>
            </div>
            {data.overallMonthTotal > 0 && (
              <div className="mt-3">
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all duration-1000" style={{ width: `${(data.educatorTotal / data.overallMonthTotal) * 100}%` }} />
                </div>
                <p className="text-right text-xs text-amber-400/60 mt-1">%{Math.round((data.educatorTotal / data.overallMonthTotal) * 100)}</p>
              </div>
            )}
          </div>
          <div className="bg-gradient-to-br from-sky-600/20 to-blue-600/20 border border-sky-500/30 rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute top-3 right-3 text-4xl opacity-20">👤</div>
            <p className="text-sm text-sky-300 font-medium">Bireysel Ciro</p>
            <p className="text-3xl font-bold text-white mt-2">{formatTL(data.individualTotal)} ₺</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-sky-400/70">{data.individualSaleCount} satış</span>
              <span className="text-xs text-sky-400/70">Bugün: {formatTL(data.todayIndividualTotal)} ₺</span>
            </div>
            {data.overallMonthTotal > 0 && (
              <div className="mt-3">
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-sky-500 to-blue-400 rounded-full transition-all duration-1000" style={{ width: `${(data.individualTotal / data.overallMonthTotal) * 100}%` }} />
                </div>
                <p className="text-right text-xs text-sky-400/60 mt-1">%{Math.round((data.individualTotal / data.overallMonthTotal) * 100)}</p>
              </div>
            )}
          </div>
          <div className="bg-gradient-to-br from-red-600/20 to-rose-600/20 border border-red-500/30 rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute top-3 right-3 text-4xl opacity-20">↩️</div>
            <p className="text-sm text-red-300 font-medium">İadeler</p>
            <p className="text-3xl font-bold text-white mt-2">{formatTL(data.totalRefunds)} ₺</p>
            <div className="mt-2">
              <span className="text-xs text-red-400/70">Net Ciro: </span>
              <span className="text-sm text-green-400 font-bold">{formatTL(data.netMonthTotal)} ₺</span>
            </div>
          </div>
        </div>

        {/* Team Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {sorted.map((stat, i) => (
            <TeamCard key={stat.team.id} stat={stat} rank={i} />
          ))}
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-2 gap-6">
          {/* Live Feed */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Canlı Satışlar
            </h2>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {data.todaySales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2 h-8 rounded-full"
                      style={{ backgroundColor: sale.user.team?.color || "#666" }}
                    />
                    <div>
                      <span className="text-sm font-medium">{sale.user.name}</span>
                      <p className="text-xs text-slate-400">
                        {sale.package
                          ? `${sale.package.product.name} — ${sale.package.name}`
                          : `${sale.personCount} Kişi • ${DURATION_LABELS[sale.duration] || sale.duration} • ${TYPE_LABELS[sale.packageType] || sale.packageType}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-green-400 font-bold">{formatTL(sale.totalPrice)} ₺</span>
                    <p className="text-xs text-slate-500">
                      {new Date(sale.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
              {data.todaySales.length === 0 && (
                <p className="text-center text-slate-500 py-8">Henüz satış yok</p>
              )}
            </div>
          </div>

          {/* Bonus Tiers */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-lg font-bold mb-4">💰 Günlük Prim Basamakları</h2>
            <div className="space-y-2">
              {data.bonusTiers.map((tier, i) => {
                const anyTeamReached = sorted.some((s) => s.todayTotal >= tier.minAmount);
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                      anyTeamReached
                        ? "bg-green-500/20 border border-green-500/30"
                        : "bg-white/5 border border-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{anyTeamReached ? "✅" : "⬜"}</span>
                      <span className="text-sm">{formatTL(tier.minAmount)} ₺ satış</span>
                    </div>
                    <span className={`font-bold ${anyTeamReached ? "text-green-400" : "text-slate-400"}`}>
                      {formatTL(tier.bonusAmount)} ₺
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Leaderboard */}
            <h2 className="text-lg font-bold mt-8 mb-4">🏆 Sıralama</h2>
            <div className="space-y-2">
              {sorted.map((stat, i) => (
                <div
                  key={stat.team.id}
                  className="flex items-center gap-3 p-3 bg-white/5 rounded-xl"
                >
                  <span className="text-xl w-8 text-center">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                  </span>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stat.team.color }} />
                  <span className="flex-1 font-medium">{stat.team.name}</span>
                  <span className="text-green-400 font-bold">{formatTL(stat.todayTotal)} ₺</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
