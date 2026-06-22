"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface DeletionRequest {
  id: string;
  reason: string;
  status: string;
  createdAt: string;
  requestedBy: { name: string };
  sale: {
    id: string;
    totalPrice: number;
    createdAt: string;
    personCount: number;
    duration: string;
    packageType: string;
    user: { name: string; team: { name: string } | null };
    package: { name: string; product: { name: string } } | null;
  };
}

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  createdAt: string;
  user: { name: string; email: string };
  oldData: string | null;
  newData: string | null;
}

interface User {
  id: string;
  name: string;
  role: string;
}

interface TeamData {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  members: { id: string; name: string; email: string }[];
}

interface ProductData {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  packages: PackageData[];
}

interface PackageData {
  id: string;
  name: string;
  basePrice: number;
  personCount: number;
  duration: string;
  paymentLinkPayTR: string | null;
  paymentLinkSuperead: string | null;
  isActive: boolean;
  productId: string;
}

interface RefundData {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
  user: { id: string; name: string; team: { name: string; color: string } | null };
  sale: { id: string; totalPrice: number; packageType: string } | null;
  createdBy: { name: string };
}

type Tab = "overview" | "refunds" | "deletions" | "audit" | "goals" | "bonuses" | "products" | "teams";

function formatTL(n: number) {
  return new Intl.NumberFormat("tr-TR").format(n);
}

const actionLabels: Record<string, string> = {
  create: "Oluşturma",
  update: "Güncelleme",
  delete: "Silme",
  deletion_request: "Silme Talebi",
  deletion_approve: "Silme Onayı",
  deletion_reject: "Silme Reddi",
};

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [deletionRequests, setDeletionRequests] = useState<DeletionRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [dashData, setDashData] = useState<Record<string, unknown> | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Goal form
  const [goalType, setGoalType] = useState("daily");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalPeriod, setGoalPeriod] = useState("");
  const [goalIsGlobal, setGoalIsGlobal] = useState(true);

  // Bonus form
  const [bonusMin, setBonusMin] = useState("");
  const [bonusAmount, setBonusAmount] = useState("");

  // Products
  const [products, setProducts] = useState<ProductData[]>([]);
  const [editingPkg, setEditingPkg] = useState<string | null>(null);
  const [editPkgName, setEditPkgName] = useState("");
  const [editPkgPrice, setEditPkgPrice] = useState("");
  const [editPkgPersonCount, setEditPkgPersonCount] = useState("1");
  const [editPkgDuration, setEditPkgDuration] = useState("yearly");
  const [editPkgPayTR, setEditPkgPayTR] = useState("");
  const [editPkgPaySuperead, setEditPkgPaySuperead] = useState("");
  const [newPkgProductId, setNewPkgProductId] = useState("");
  const [newPkgName, setNewPkgName] = useState("");
  const [newPkgPrice, setNewPkgPrice] = useState("");
  const [newPkgPersonCount, setNewPkgPersonCount] = useState("1");
  const [newPkgDuration, setNewPkgDuration] = useState("yearly");
  const [newProductName, setNewProductName] = useState("");
  const [newProductDesc, setNewProductDesc] = useState("");
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editProductName, setEditProductName] = useState("");
  const [editProductDesc, setEditProductDesc] = useState("");

  // Teams
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [editTeamName, setEditTeamName] = useState("");
  const [editTeamColor, setEditTeamColor] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamColor, setNewTeamColor] = useState("#6c5ce7");
  const [newMember1, setNewMember1] = useState("");
  const [newMember2, setNewMember2] = useState("");
  const [addMemberTeamId, setAddMemberTeamId] = useState<string | null>(null);
  const [addMemberName, setAddMemberName] = useState("");
  const [addMemberEmail, setAddMemberEmail] = useState("");

  // Refunds
  const [refunds, setRefunds] = useState<RefundData[]>([]);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundUserId, setRefundUserId] = useState("");

  // Filters for sales table
  const [filterAgent, setFilterAgent] = useState("");
  const [filterType, setFilterType] = useState("");

  const loadData = useCallback(async () => {
    const [delRes, auditRes, dashRes, prodRes, teamRes, refRes] = await Promise.all([
      fetch("/api/admin/deletion-requests"),
      fetch("/api/admin/audit-logs"),
      fetch(`/api/dashboard?month=${selectedMonth}`),
      fetch("/api/admin/products"),
      fetch("/api/admin/teams"),
      fetch(`/api/admin/refunds?month=${selectedMonth}`),
    ]);
    if (delRes.ok) setDeletionRequests(await delRes.json());
    if (auditRes.ok) setAuditLogs(await auditRes.json());
    if (dashRes.ok) setDashData(await dashRes.json());
    if (prodRes.ok) setProducts(await prodRes.json());
    if (teamRes.ok) setTeams(await teamRes.json());
    if (refRes.ok) setRefunds(await refRes.json());
  }, [selectedMonth]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.error || d.user.role !== "admin") router.push("/login");
        else setUser(d.user);
      });
  }, [router]);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  async function handleDeletionAction(requestId: string, action: "approve" | "reject") {
    await fetch("/api/admin/deletion-requests", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, action }),
    });
    await loadData();
  }

  async function handleCreateGoal(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: goalType,
        target: Number(goalTarget),
        period: goalPeriod,
        isGlobal: goalIsGlobal,
      }),
    });
    setGoalTarget("");
    setGoalPeriod("");
    await loadData();
  }

  async function handleCreateBonus(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/bonus-tiers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        minAmount: Number(bonusMin),
        bonusAmount: Number(bonusAmount),
      }),
    });
    setBonusMin("");
    setBonusAmount("");
  }

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newProductName, description: newProductDesc || null }),
    });
    if (res.ok) {
      setNewProductName("");
      setNewProductDesc("");
      await loadData();
    }
  }

  async function handleUpdateProduct(id: string) {
    await fetch("/api/admin/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editProductName, description: editProductDesc }),
    });
    setEditingProduct(null);
    await loadData();
  }

  async function handleToggleProduct(id: string, isActive: boolean) {
    await fetch("/api/admin/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: !isActive }),
    });
    await loadData();
  }

  async function handleCreatePackage(e: React.FormEvent, productId?: string) {
    e.preventDefault();
    const pid = productId || newPkgProductId;
    if (!pid) return;
    const res = await fetch("/api/admin/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newPkgName,
        basePrice: Number(newPkgPrice),
        personCount: Number(newPkgPersonCount),
        duration: newPkgDuration,
        productId: pid,
      }),
    });
    if (res.ok) {
      setNewPkgName("");
      setNewPkgPrice("");
      setNewPkgPersonCount("1");
      setNewPkgDuration("yearly");
      setNewPkgProductId("");
      await loadData();
    }
  }

  async function handleUpdatePackage(id: string) {
    await fetch("/api/admin/packages", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        name: editPkgName,
        basePrice: Number(editPkgPrice),
        personCount: Number(editPkgPersonCount),
        duration: editPkgDuration,
        paymentLinkPayTR: editPkgPayTR || null,
        paymentLinkSuperead: editPkgPaySuperead || null,
      }),
    });
    setEditingPkg(null);
    await loadData();
  }

  async function handleTogglePackage(id: string, isActive: boolean) {
    await fetch("/api/admin/packages", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: !isActive }),
    });
    await loadData();
  }

  async function handleDeletePackage(id: string) {
    if (!confirm("Bu paketi silmek istediğinize emin misiniz?")) return;
    await fetch("/api/admin/packages", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await loadData();
  }

  async function handleUpdateTeam(id: string) {
    await fetch("/api/admin/teams", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editTeamName, color: editTeamColor }),
    });
    setEditingTeam(null);
    await loadData();
  }

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    const members: {name: string; email: string}[] = [];
    if (newMember1.trim()) {
      const email = newMember1.trim().toLowerCase().replace(/ı/g, "i").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g") + "@superead.com";
      members.push({ name: newMember1.trim(), email });
    }
    if (newMember2.trim()) {
      const email = newMember2.trim().toLowerCase().replace(/ı/g, "i").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g") + "@superead.com";
      members.push({ name: newMember2.trim(), email });
    }
    const res = await fetch("/api/admin/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTeamName, color: newTeamColor, members }),
    });
    if (res.ok) {
      setNewTeamName("");
      setNewTeamColor("#6c5ce7");
      setNewMember1("");
      setNewMember2("");
      await loadData();
    } else {
      const err = await res.json();
      alert(err.error || "Hata oluştu");
    }
  }

  async function handleAddMember(teamId: string) {
    if (!addMemberName || !addMemberEmail) return;
    const res = await fetch("/api/admin/teams", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add-member", teamId, name: addMemberName, email: addMemberEmail }),
    });
    if (res.ok) {
      setAddMemberTeamId(null);
      setAddMemberName("");
      setAddMemberEmail("");
      await loadData();
    } else {
      const err = await res.json();
      alert(err.error || "Hata oluştu");
    }
  }

  async function handleRemoveMember(userId: string, userName: string) {
    if (!confirm(`${userName} takımdan çıkarılsın mı?`)) return;
    await fetch("/api/admin/teams", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove-member", userId }),
    });
    await loadData();
  }

  async function handleCreateRefund(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/refunds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(refundAmount),
        reason: refundReason,
        userId: refundUserId,
      }),
    });
    if (res.ok) {
      setRefundAmount("");
      setRefundReason("");
      setRefundUserId("");
      await loadData();
    }
  }

  async function handleDeleteRefund(id: string) {
    if (!confirm("Bu iadeyi silmek istediğinize emin misiniz?")) return;
    await fetch("/api/admin/refunds", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await loadData();
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (!user) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Yükleniyor...</div>;

  const tabs: { key: Tab; label: string; icon: string; badge?: number }[] = [
    { key: "overview", label: "Genel Bakış", icon: "📊" },
    { key: "refunds", label: "İadeler", icon: "↩️", badge: refunds.length },
    { key: "deletions", label: "Silme Talepleri", icon: "🗑️", badge: deletionRequests.length },
    { key: "audit", label: "İşlem Geçmişi", icon: "📋" },
    { key: "goals", label: "Hedefler", icon: "🎯" },
    { key: "bonuses", label: "Primler", icon: "💰" },
    { key: "products", label: "Ürünler & Paketler", icon: "📦" },
    { key: "teams", label: "Takımlar", icon: "👥" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">🔐 Admin Paneli</h1>
            <p className="text-sm text-slate-400">Hoş geldin, {user.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="px-4 py-2 bg-purple-600/30 text-purple-300 rounded-lg text-sm hover:bg-purple-600/50 transition">
              📊 Dashboard
            </a>
            <button onClick={handleLogout} className="px-4 py-2 bg-red-600/30 text-red-300 rounded-lg text-sm hover:bg-red-600/50 transition">
              Çıkış
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition ${
                tab === t.key ? "bg-purple-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"
              }`}
            >
              {t.icon} {t.label}
              {t.badge ? (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{t.badge}</span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === "overview" && dashData && (
          <div className="space-y-6">
            {/* Month Selector */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const [y, m] = selectedMonth.split("-").map(Number);
                  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
                  setSelectedMonth(prev);
                }}
                className="px-3 py-2 bg-white/10 rounded-xl text-white hover:bg-white/20 transition"
              >
                ◀
              </button>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
              <button
                onClick={() => {
                  const [y, m] = selectedMonth.split("-").map(Number);
                  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
                  setSelectedMonth(next);
                }}
                className="px-3 py-2 bg-white/10 rounded-xl text-white hover:bg-white/20 transition"
              >
                ▶
              </button>
              <button
                onClick={() => {
                  const now = new Date();
                  setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
                }}
                className="px-4 py-2 bg-purple-600/30 border border-purple-500/40 rounded-xl text-purple-300 text-sm hover:bg-purple-600/50 transition"
              >
                Bu Ay
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(dashData.isCurrentMonth as boolean) && (
                <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-2xl p-5">
                  <p className="text-sm text-purple-300">Bugün Toplam</p>
                  <p className="text-3xl font-bold text-white">{formatTL(dashData.overallTodayTotal as number)} ₺</p>
                </div>
              )}
              <div className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border border-blue-500/30 rounded-2xl p-5">
                <p className="text-sm text-blue-300">Ay Toplam</p>
                <p className="text-3xl font-bold text-white">{formatTL(dashData.overallMonthTotal as number)} ₺</p>
              </div>
              <div className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 border border-green-500/30 rounded-2xl p-5">
                <p className="text-sm text-green-300">Net Ciro</p>
                <p className="text-3xl font-bold text-white">{formatTL(dashData.netMonthTotal as number)} ₺</p>
                {(dashData.totalRefunds as number) > 0 && (
                  <p className="text-xs text-red-400 mt-1">-{formatTL(dashData.totalRefunds as number)} ₺ iade</p>
                )}
              </div>
              <div className="bg-gradient-to-br from-red-600/20 to-orange-600/20 border border-red-500/30 rounded-2xl p-5">
                <p className="text-sm text-red-300">Bekleyen Silme Talebi</p>
                <p className="text-3xl font-bold text-white">{deletionRequests.length}</p>
              </div>
            </div>

            {/* Type Breakdown */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-amber-600/20 to-orange-600/20 border border-amber-500/30 rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-amber-300 font-medium">👩‍🏫 Eğitici Cirosu</p>
                    <p className="text-2xl font-bold text-white mt-1">{formatTL(dashData.educatorTotal as number)} ₺</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-amber-400/70">{dashData.educatorSaleCount as number} satış</p>
                    {(dashData.overallMonthTotal as number) > 0 && (
                      <p className="text-lg font-bold text-amber-400">%{Math.round(((dashData.educatorTotal as number) / (dashData.overallMonthTotal as number)) * 100)}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-sky-600/20 to-blue-600/20 border border-sky-500/30 rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-sky-300 font-medium">👤 Bireysel Ciro</p>
                    <p className="text-2xl font-bold text-white mt-1">{formatTL(dashData.individualTotal as number)} ₺</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-sky-400/70">{dashData.individualSaleCount as number} satış</p>
                    {(dashData.overallMonthTotal as number) > 0 && (
                      <p className="text-lg font-bold text-sky-400">%{Math.round(((dashData.individualTotal as number) / (dashData.overallMonthTotal as number)) * 100)}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="font-bold text-white mb-4">Ekip Performansı</h3>
              {(dashData.teamStats as TeamStatRaw[])?.map((stat: TeamStatRaw) => (
                <div key={stat.team.id} className="flex items-center gap-4 p-3 border-b border-white/5 last:border-0">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stat.team.color }} />
                  <span className="flex-1 text-white font-medium">{stat.team.name}</span>
                  <div className="text-right">
                    <span className="text-green-400 font-bold">{formatTL(stat.monthTotal)} ₺</span>
                    <span className="text-slate-500 text-xs ml-2">({stat.monthSaleCount} satış)</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Monthly Sales Table */}
            {(dashData.monthSales as MonthSale[])?.length > 0 && (() => {
              const allSales = dashData.monthSales as MonthSale[];
              const allAgents = [...new Set(allSales.map((s) => s.user.name))].sort();
              const filteredSales = allSales.filter((sale) => {
                if (filterAgent && sale.user.name !== filterAgent) return false;
                if (filterType === "educator" && sale.packageType !== "instructor" && sale.packageType !== "educator") return false;
                if (filterType === "individual" && sale.packageType !== "individual") return false;
                return true;
              });
              const filteredTotal = filteredSales.reduce((sum, s) => sum + s.totalPrice, 0);
              return (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-white">Aylık Satış Detayları</h3>
                  <span className="text-sm text-green-400 font-bold">{filteredSales.length} satış — {formatTL(filteredTotal)} ₺</span>
                </div>
                <div className="flex gap-3 mb-4">
                  <select
                    value={filterAgent}
                    onChange={(e) => setFilterAgent(e.target.value)}
                    className="px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    <option value="">Tüm Satışçılar</option>
                    {allAgents.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    <option value="">Tüm Türler</option>
                    <option value="educator">👩‍🏫 Eğitici</option>
                    <option value="individual">👤 Bireysel</option>
                  </select>
                  {(filterAgent || filterType) && (
                    <button
                      onClick={() => { setFilterAgent(""); setFilterType(""); }}
                      className="px-3 py-2 bg-red-600/30 text-red-300 rounded-xl text-sm hover:bg-red-600/50 transition"
                    >
                      Filtreyi Temizle
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-800">
                      <tr className="text-slate-400 border-b border-white/10">
                        <th className="text-left py-2 px-3">Tarih</th>
                        <th className="text-left py-2 px-3">Satışçı</th>
                        <th className="text-left py-2 px-3">Ekip</th>
                        <th className="text-left py-2 px-3">Tür</th>
                        <th className="text-left py-2 px-3">Detay</th>
                        <th className="text-right py-2 px-3">Tutar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSales.map((sale) => (
                        <tr key={sale.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-2 px-3 text-slate-300">
                            {new Date(sale.createdAt).toLocaleDateString("tr-TR")}
                          </td>
                          <td className="py-2 px-3 text-white">{sale.user.name}</td>
                          <td className="py-2 px-3">
                            {sale.user.team && (
                              <span className="inline-flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sale.user.team.color }} />
                                <span className="text-slate-300 text-xs">{sale.user.team.name}</span>
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs ${
                              sale.packageType === "instructor" || sale.packageType === "educator"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-sky-500/20 text-sky-300"
                            }`}>
                              {TYPE_LABELS[sale.packageType] || sale.packageType}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-300">
                            {sale.package ? (
                              <>
                                <span className="text-purple-400 text-xs">{sale.package.product.name}</span>
                                <br />
                                {sale.package.name}
                              </>
                            ) : (
                              <span className="text-purple-400 text-xs">
                                {sale.personCount} Kişi • {DURATION_LABELS[sale.duration] || sale.duration}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right text-green-400 font-medium">
                            {formatTL(sale.totalPrice)} ₺
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              );
            })()}
          </div>
        )}

        {/* Refunds Tab */}
        {tab === "refunds" && (
          <div className="space-y-6">
            <form onSubmit={handleCreateRefund} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-white">↩️ Yeni İade Girişi</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-purple-300 text-sm mb-1">Satışçı</label>
                  <select
                    value={refundUserId}
                    onChange={(e) => setRefundUserId(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    required
                  >
                    <option value="">Satışçı Seçin</option>
                    {teams.flatMap((t) => t.members.map((m) => (
                      <option key={m.id} value={m.id}>{m.name} ({t.name})</option>
                    )))}
                  </select>
                </div>
                <div>
                  <label className="block text-purple-300 text-sm mb-1">İade Tutarı (₺)</label>
                  <input
                    type="number"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    placeholder="1000"
                    required
                  />
                </div>
                <div>
                  <label className="block text-purple-300 text-sm mb-1">Sebep</label>
                  <input
                    type="text"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    placeholder="İade sebebi"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                className="px-6 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition"
              >
                İade Kaydet
              </button>
            </form>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="font-bold text-white mb-4">Bu Ay İadeler</h3>
              {refunds.length === 0 ? (
                <p className="text-center text-slate-500 py-6">Bu ay iade kaydı yok</p>
              ) : (
                <>
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between">
                    <span className="text-red-300">Toplam İade</span>
                    <span className="text-red-400 font-bold text-xl">{formatTL(refunds.reduce((s, r) => s + r.amount, 0))} ₺</span>
                  </div>
                  <div className="space-y-2">
                    {refunds.map((refund) => (
                      <div key={refund.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition">
                        <div className="flex items-center gap-3">
                          {refund.user.team && (
                            <div className="w-2 h-8 rounded-full" style={{ backgroundColor: refund.user.team.color }} />
                          )}
                          <div>
                            <span className="text-white font-medium">{refund.user.name}</span>
                            <p className="text-xs text-slate-400">{refund.reason}</p>
                            <p className="text-xs text-slate-500">
                              {new Date(refund.createdAt).toLocaleDateString("tr-TR")} • {refund.createdBy.name}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-red-400 font-bold">{formatTL(refund.amount)} ₺</span>
                          <button
                            onClick={() => handleDeleteRefund(refund.id)}
                            className="px-2 py-1 bg-red-600/30 text-red-300 rounded text-xs hover:bg-red-600/50 transition"
                          >
                            Sil
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Deletion Requests Tab */}
        {tab === "deletions" && (
          <div className="space-y-3">
            {deletionRequests.length === 0 ? (
              <div className="bg-white/5 rounded-2xl p-8 text-center text-slate-400">
                Bekleyen silme talebi yok ✅
              </div>
            ) : (
              deletionRequests.map((req) => (
                <div key={req.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white font-medium">
                        {req.sale.user.name} — {req.sale.package ? req.sale.package.product.name : `${req.sale.personCount} Kişi • ${DURATION_LABELS[req.sale.duration] || req.sale.duration}`}
                      </p>
                      <p className="text-sm text-slate-400">
                        {req.sale.package ? req.sale.package.name : (TYPE_LABELS[req.sale.packageType] || req.sale.packageType)} • {formatTL(req.sale.totalPrice)} ₺
                      </p>
                      <p className="text-sm text-yellow-300 mt-1">Sebep: {req.reason}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Talep eden: {req.requestedBy.name} •{" "}
                        {new Date(req.createdAt).toLocaleString("tr-TR")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDeletionAction(req.id, "approve")}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition"
                      >
                        ✓ Onayla
                      </button>
                      <button
                        onClick={() => handleDeletionAction(req.id, "reject")}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition"
                      >
                        ✕ Reddet
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Audit Log Tab */}
        {tab === "audit" && (
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-3 text-slate-400 font-medium">Tarih</th>
                  <th className="text-left p-3 text-slate-400 font-medium">Kullanıcı</th>
                  <th className="text-left p-3 text-slate-400 font-medium">İşlem</th>
                  <th className="text-left p-3 text-slate-400 font-medium">Varlık</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3 text-slate-300">
                      {new Date(log.createdAt).toLocaleString("tr-TR")}
                    </td>
                    <td className="p-3 text-white">{log.user.name}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        log.action === "delete" || log.action === "deletion_approve"
                          ? "bg-red-500/20 text-red-300"
                          : log.action === "create"
                          ? "bg-green-500/20 text-green-300"
                          : "bg-blue-500/20 text-blue-300"
                      }`}>
                        {actionLabels[log.action] || log.action}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">{log.entity} #{log.entityId.slice(0, 8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Goals Tab */}
        {tab === "goals" && (
          <div className="space-y-6">
            <form onSubmit={handleCreateGoal} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-white">Yeni Hedef Ekle</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-purple-300 text-sm mb-1">Tip</label>
                  <select
                    value={goalType}
                    onChange={(e) => setGoalType(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    <option value="daily">Günlük</option>
                    <option value="monthly">Aylık</option>
                  </select>
                </div>
                <div>
                  <label className="block text-purple-300 text-sm mb-1">Hedef Tutar (₺)</label>
                  <input
                    type="number"
                    value={goalTarget}
                    onChange={(e) => setGoalTarget(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    placeholder="50000"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-purple-300 text-sm mb-1">
                    Dönem ({goalType === "daily" ? "YYYY-MM-DD" : "YYYY-MM"})
                  </label>
                  <input
                    type={goalType === "daily" ? "date" : "month"}
                    value={goalPeriod}
                    onChange={(e) => setGoalPeriod(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    required
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-white">
                    <input
                      type="checkbox"
                      checked={goalIsGlobal}
                      onChange={(e) => setGoalIsGlobal(e.target.checked)}
                      className="w-5 h-5 rounded"
                    />
                    Genel hedef (tüm ekipler)
                  </label>
                </div>
              </div>
              <button
                type="submit"
                className="px-6 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition"
              >
                Hedef Oluştur
              </button>
            </form>
          </div>
        )}

        {/* Bonuses Tab */}
        {tab === "bonuses" && (
          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Mevcut Prim Basamakları</h3>
              {(dashData as Record<string, unknown>)?.bonusTiers ? (
                <div className="space-y-2 mb-6">
                  {((dashData as Record<string, unknown>).bonusTiers as BonusTierRaw[]).map((tier: BonusTierRaw, i: number) => (
                    <div key={i} className="flex justify-between p-3 bg-white/5 rounded-xl">
                      <span className="text-white">{formatTL(tier.minAmount)} ₺ satış</span>
                      <span className="text-green-400 font-bold">{formatTL(tier.bonusAmount)} ₺ prim</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <form onSubmit={handleCreateBonus} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-white">Yeni Prim Basamağı</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-purple-300 text-sm mb-1">Min. Satış Tutarı (₺)</label>
                  <input
                    type="number"
                    value={bonusMin}
                    onChange={(e) => setBonusMin(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-purple-300 text-sm mb-1">Prim Tutarı (₺)</label>
                  <input
                    type="number"
                    value={bonusAmount}
                    onChange={(e) => setBonusAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                className="px-6 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition"
              >
                Basamak Ekle
              </button>
            </form>
          </div>
        )}
        {/* Teams Tab */}
        {tab === "teams" && (
          <div className="space-y-6">
            {/* New Team Form */}
            <form onSubmit={handleCreateTeam} className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Yeni Takım Ekle</h3>
              <div className="flex gap-3 mb-4">
                <input
                  type="color"
                  value={newTeamColor}
                  onChange={(e) => setNewTeamColor(e.target.value)}
                  className="w-12 h-12 rounded-lg cursor-pointer border-2 border-white/20 bg-transparent shrink-0"
                />
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  placeholder="Takım adı (ör: Şeyma-İrem)"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <input
                  type="text"
                  value={newMember1}
                  onChange={(e) => setNewMember1(e.target.value)}
                  className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  placeholder="1. Üye adı (ör: Şeyma)"
                />
                <input
                  type="text"
                  value={newMember2}
                  onChange={(e) => setNewMember2(e.target.value)}
                  className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  placeholder="2. Üye adı (ör: İrem K.)"
                />
              </div>
              <p className="text-xs text-slate-500 mb-4">Email otomatik oluşturulur: isim@superead.com — Şifre: satis123</p>
              <button
                type="submit"
                className="px-6 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition"
              >
                Takım Oluştur
              </button>
            </form>

            {/* Existing Teams */}
            {teams.map((team) => (
              <div
                key={team.id}
                className="bg-white/5 border border-white/10 rounded-2xl p-5"
              >
                {editingTeam === team.id ? (
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      value={editTeamColor}
                      onChange={(e) => setEditTeamColor(e.target.value)}
                      className="w-12 h-12 rounded-lg cursor-pointer border-2 border-white/20 bg-transparent"
                    />
                    <input
                      type="text"
                      value={editTeamName}
                      onChange={(e) => setEditTeamName(e.target.value)}
                      className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-lg font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                    <button
                      onClick={() => handleUpdateTeam(team.id)}
                      className="px-5 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition"
                    >
                      Kaydet
                    </button>
                    <button
                      onClick={() => setEditingTeam(null)}
                      className="px-5 py-3 bg-slate-600 text-white rounded-xl font-medium hover:bg-slate-700 transition"
                    >
                      İptal
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-4">
                        <div
                          className="w-10 h-10 rounded-xl"
                          style={{ backgroundColor: team.color }}
                        />
                        <h3 className="text-lg font-bold text-white">{team.name}</h3>
                      </div>
                      <button
                        onClick={() => {
                          setEditingTeam(team.id);
                          setEditTeamName(team.name);
                          setEditTeamColor(team.color);
                        }}
                        className="px-4 py-2 bg-blue-600/30 text-blue-300 rounded-lg text-sm hover:bg-blue-600/50 transition"
                      >
                        Düzenle
                      </button>
                    </div>
                    <div className="space-y-2 ml-14">
                      {team.members.map((m) => (
                        <div key={m.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                          <div>
                            <span className="text-white text-sm font-medium">{m.name}</span>
                            <span className="text-slate-500 text-xs ml-2">{m.email}</span>
                          </div>
                          <button
                            onClick={() => handleRemoveMember(m.id, m.name)}
                            className="text-red-400 hover:text-red-300 text-xs"
                          >
                            Çıkar
                          </button>
                        </div>
                      ))}
                      {team.members.length === 0 && (
                        <p className="text-slate-500 text-sm">Henüz üye yok</p>
                      )}
                      {addMemberTeamId === team.id ? (
                        <div className="flex gap-2 mt-2">
                          <input
                            type="text"
                            value={addMemberName}
                            onChange={(e) => setAddMemberName(e.target.value)}
                            className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                            placeholder="İsim"
                          />
                          <input
                            type="email"
                            value={addMemberEmail}
                            onChange={(e) => setAddMemberEmail(e.target.value)}
                            className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                            placeholder="email@superead.com"
                          />
                          <button
                            onClick={() => handleAddMember(team.id)}
                            className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition"
                          >
                            Ekle
                          </button>
                          <button
                            onClick={() => setAddMemberTeamId(null)}
                            className="px-3 py-2 bg-slate-600 text-white rounded-lg text-sm hover:bg-slate-700 transition"
                          >
                            İptal
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setAddMemberTeamId(team.id);
                            setAddMemberName("");
                            setAddMemberEmail("");
                          }}
                          className="text-purple-400 hover:text-purple-300 text-sm mt-1"
                        >
                          + Üye Ekle
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Products & Packages Tab */}
        {tab === "products" && (
          <div className="space-y-6">
            {/* Add New Product */}
            <form onSubmit={handleCreateProduct} className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Yeni Ürün Ekle</h3>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  placeholder="Ürün adı"
                  required
                />
                <input
                  type="text"
                  value={newProductDesc}
                  onChange={(e) => setNewProductDesc(e.target.value)}
                  className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  placeholder="Açıklama (opsiyonel)"
                />
                <button
                  type="submit"
                  className="px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition whitespace-nowrap"
                >
                  + Ürün Ekle
                </button>
              </div>
            </form>

            {/* Products List */}
            {products.map((product) => (
              <div
                key={product.id}
                className={`bg-white/5 border rounded-2xl overflow-hidden ${
                  product.isActive ? "border-white/10" : "border-red-500/30 opacity-60"
                }`}
              >
                {/* Product Header */}
                <div className="px-6 py-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
                  {editingProduct === product.id ? (
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="text"
                        value={editProductName}
                        onChange={(e) => setEditProductName(e.target.value)}
                        className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={editProductDesc}
                        onChange={(e) => setEditProductDesc(e.target.value)}
                        className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:outline-none flex-1"
                        placeholder="Açıklama"
                      />
                      <button
                        onClick={() => handleUpdateProduct(product.id)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition"
                      >
                        Kaydet
                      </button>
                      <button
                        onClick={() => setEditingProduct(null)}
                        className="px-4 py-2 bg-slate-600 text-white rounded-lg text-sm hover:bg-slate-700 transition"
                      >
                        İptal
                      </button>
                    </div>
                  ) : (
                    <>
                      <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          {product.name}
                          {!product.isActive && (
                            <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">Pasif</span>
                          )}
                        </h3>
                        {product.description && <p className="text-sm text-slate-400">{product.description}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingProduct(product.id);
                            setEditProductName(product.name);
                            setEditProductDesc(product.description || "");
                          }}
                          className="px-3 py-1.5 bg-blue-600/30 text-blue-300 rounded-lg text-sm hover:bg-blue-600/50 transition"
                        >
                          Düzenle
                        </button>
                        <button
                          onClick={() => handleToggleProduct(product.id, product.isActive)}
                          className={`px-3 py-1.5 rounded-lg text-sm transition ${
                            product.isActive
                              ? "bg-red-600/30 text-red-300 hover:bg-red-600/50"
                              : "bg-green-600/30 text-green-300 hover:bg-green-600/50"
                          }`}
                        >
                          {product.isActive ? "Pasife Al" : "Aktifleştir"}
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Packages Table */}
                <div className="p-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-white/10">
                        <th className="pb-2 text-slate-400 font-medium">Paket Adı</th>
                        <th className="pb-2 text-slate-400 font-medium text-right">Fiyat (₺)</th>
                        <th className="pb-2 text-slate-400 font-medium text-center">Kişi</th>
                        <th className="pb-2 text-slate-400 font-medium text-center">Süre</th>
                        <th className="pb-2 text-slate-400 font-medium text-center">Linkler</th>
                        <th className="pb-2 text-slate-400 font-medium text-center">Durum</th>
                        <th className="pb-2 text-slate-400 font-medium text-right">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody>
                      {product.packages.map((pkg) => (
                        <tr
                          key={pkg.id}
                          className={`border-b border-white/5 ${!pkg.isActive ? "opacity-40" : ""}`}
                        >
                          {editingPkg === pkg.id ? (
                            <>
                              <td className="py-2 pr-2">
                                <input
                                  type="text"
                                  value={editPkgName}
                                  onChange={(e) => setEditPkgName(e.target.value)}
                                  className="w-full px-2 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  value={editPkgPrice}
                                  onChange={(e) => setEditPkgPrice(e.target.value)}
                                  className="w-full px-2 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm text-right focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  value={editPkgPersonCount}
                                  onChange={(e) => setEditPkgPersonCount(e.target.value)}
                                  className="w-20 mx-auto px-2 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm text-center focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <select
                                  value={editPkgDuration}
                                  onChange={(e) => setEditPkgDuration(e.target.value)}
                                  className="mx-auto px-2 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                >
                                  <option value="3month">3 Ay</option>
                                  <option value="yearly">Yıllık</option>
                                  <option value="lifetime">Ömür Boyu</option>
                                  <option value="custom">Özel</option>
                                </select>
                              </td>
                              <td className="py-2 px-2" colSpan={2}>
                                <input
                                  type="text"
                                  value={editPkgPayTR}
                                  onChange={(e) => setEditPkgPayTR(e.target.value)}
                                  className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded-lg text-white text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none mb-1"
                                  placeholder="PayTR linki"
                                />
                                <input
                                  type="text"
                                  value={editPkgPaySuperead}
                                  onChange={(e) => setEditPkgPaySuperead(e.target.value)}
                                  className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded-lg text-white text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                  placeholder="Superead linki"
                                />
                              </td>
                              <td className="py-2 pl-2 text-right">
                                <div className="flex justify-end gap-1">
                                  <button
                                    onClick={() => handleUpdatePackage(pkg.id)}
                                    className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={() => setEditingPkg(null)}
                                    className="px-2 py-1 bg-slate-600 text-white rounded text-xs hover:bg-slate-700"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-2.5 text-white font-medium">{pkg.name}</td>
                              <td className="py-2.5 text-green-400 font-bold text-right">{formatTL(pkg.basePrice)} ₺</td>
                              <td className="py-2.5 text-slate-300 text-center">{pkg.personCount}</td>
                              <td className="py-2.5 text-slate-300 text-center">
                                {pkg.duration === "3month" ? "3 Ay" : pkg.duration === "yearly" ? "Yıllık" : pkg.duration === "lifetime" ? "Ömür Boyu" : pkg.duration === "custom" ? "Özel" : pkg.duration}
                              </td>
                              <td className="py-2.5 text-center">
                                <div className="flex justify-center gap-1">
                                  {pkg.paymentLinkPayTR && <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded text-[10px]">PayTR</span>}
                                  {pkg.paymentLinkSuperead && <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[10px]">SE</span>}
                                  {!pkg.paymentLinkPayTR && !pkg.paymentLinkSuperead && <span className="text-slate-600 text-xs">—</span>}
                                </div>
                              </td>
                              <td className="py-2.5 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-xs ${
                                  pkg.isActive ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"
                                }`}>
                                  {pkg.isActive ? "Aktif" : "Pasif"}
                                </span>
                              </td>
                              <td className="py-2.5 text-right">
                                <div className="flex justify-end gap-1">
                                  <button
                                    onClick={() => {
                                      setEditingPkg(pkg.id);
                                      setEditPkgName(pkg.name);
                                      setEditPkgPrice(String(pkg.basePrice));
                                      setEditPkgPersonCount(String(pkg.personCount));
                                      setEditPkgDuration(pkg.duration);
                                      setEditPkgPayTR(pkg.paymentLinkPayTR || "");
                                      setEditPkgPaySuperead(pkg.paymentLinkSuperead || "");
                                    }}
                                    className="px-2 py-1 bg-blue-600/30 text-blue-300 rounded text-xs hover:bg-blue-600/50"
                                  >
                                    Düzenle
                                  </button>
                                  <button
                                    onClick={() => handleTogglePackage(pkg.id, pkg.isActive)}
                                    className={`px-2 py-1 rounded text-xs ${
                                      pkg.isActive ? "bg-yellow-600/30 text-yellow-300 hover:bg-yellow-600/50" : "bg-green-600/30 text-green-300 hover:bg-green-600/50"
                                    }`}
                                  >
                                    {pkg.isActive ? "Pasif" : "Aktif"}
                                  </button>
                                  <button
                                    onClick={() => handleDeletePackage(pkg.id)}
                                    className="px-2 py-1 bg-red-600/30 text-red-300 rounded text-xs hover:bg-red-600/50"
                                  >
                                    Sil
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {product.packages.length === 0 && (
                    <p className="text-center text-slate-500 py-4 text-sm">Bu ürüne ait paket yok</p>
                  )}
                </div>

                {/* Add Package to this Product */}
                {product.isActive && (
                  <div className="px-4 pb-4">
                    <form
                      onSubmit={(e) => handleCreatePackage(e, product.id)}
                      className="flex items-end gap-2 p-3 bg-white/5 rounded-xl"
                    >
                      <div className="flex-1">
                        <label className="block text-xs text-slate-400 mb-1">Paket Adı</label>
                        <input
                          type="text"
                          value={newPkgProductId === product.id ? newPkgName : ""}
                          onChange={(e) => {
                            setNewPkgProductId(product.id);
                            setNewPkgName(e.target.value);
                          }}
                          onFocus={() => setNewPkgProductId(product.id)}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                          placeholder="Tekli (Yıllık)"
                          required
                        />
                      </div>
                      <div className="w-28">
                        <label className="block text-xs text-slate-400 mb-1">Fiyat (₺)</label>
                        <input
                          type="number"
                          value={newPkgProductId === product.id ? newPkgPrice : ""}
                          onChange={(e) => {
                            setNewPkgProductId(product.id);
                            setNewPkgPrice(e.target.value);
                          }}
                          onFocus={() => setNewPkgProductId(product.id)}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                          placeholder="5000"
                          required
                        />
                      </div>
                      <div className="w-20">
                        <label className="block text-xs text-slate-400 mb-1">Kişi</label>
                        <input
                          type="number"
                          value={newPkgProductId === product.id ? newPkgPersonCount : "1"}
                          onChange={(e) => {
                            setNewPkgProductId(product.id);
                            setNewPkgPersonCount(e.target.value);
                          }}
                          onFocus={() => setNewPkgProductId(product.id)}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                          min="1"
                        />
                      </div>
                      <div className="w-28">
                        <label className="block text-xs text-slate-400 mb-1">Süre</label>
                        <select
                          value={newPkgProductId === product.id ? newPkgDuration : "yearly"}
                          onChange={(e) => {
                            setNewPkgProductId(product.id);
                            setNewPkgDuration(e.target.value);
                          }}
                          onFocus={() => setNewPkgProductId(product.id)}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        >
                          <option value="3month">3 Ay</option>
                          <option value="yearly">Yıllık</option>
                          <option value="lifetime">Ömür Boyu</option>
                        </select>
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition whitespace-nowrap"
                      >
                        + Paket
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
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

interface MonthSale {
  id: string;
  totalPrice: number;
  createdAt: string;
  personCount: number;
  duration: string;
  packageType: string;
  user: { name: string; team: { name: string; color: string } | null };
  package: { name: string; product: { name: string } } | null;
}

interface TeamStatRaw {
  team: { id: string; name: string; color: string };
  todayTotal: number;
  todaySaleCount: number;
  monthTotal: number;
  monthSaleCount: number;
}

interface BonusTierRaw {
  minAmount: number;
  bonusAmount: number;
}
