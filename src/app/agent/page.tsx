"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Package {
  id: string;
  name: string;
  basePrice: number;
  personCount: number;
  duration: string;
  paymentLinkPayTR: string | null;
  paymentLinkSuperead: string | null;
  product: { id: string; name: string };
}

interface Sale {
  id: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  discount: number;
  discountReason: string | null;
  customerType: string;
  personCount: number;
  duration: string;
  packageType: string;
  createdAt: string;
  package: Package | null;
  deletionRequest: { status: string } | null;
}

interface User {
  id: string;
  name: string;
  role: string;
  teamId: string | null;
}

const DURATION_LABELS: Record<string, string> = {
  monthly: "Aylık",
  "3month": "3 Aylık",
  yearly: "Yıllık",
  lifetime: "Ömürlük",
};

const TYPE_LABELS: Record<string, string> = {
  instructor: "Eğitmen",
  individual: "Bireysel",
};

export default function AgentPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [monthlySales, setMonthlySales] = useState<Sale[]>([]);
  const [showMonthly, setShowMonthly] = useState(false);

  // Form state
  const [formPersonCount, setFormPersonCount] = useState(1);
  const [formDuration, setFormDuration] = useState("yearly");
  const [formPackageType, setFormPackageType] = useState("individual");
  const [formPrice, setFormPrice] = useState("");
  const [discount, setDiscount] = useState(0);
  const [discountReason, setDiscountReason] = useState("");
  const [customerType, setCustomerType] = useState("new");
  const [customerNote, setCustomerNote] = useState("");

  // Edit state
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");

  // Refunds
  const [monthRefunds, setMonthRefunds] = useState<{id: string; amount: number; reason: string; createdAt: string}[]>([]);

  // Password change
  const [showPassword, setShowPassword] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");

  const loadSales = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const [dayRes, monthRes, refRes] = await Promise.all([
      fetch(`/api/sales?date=${today}&userId=${user?.id}`),
      fetch(`/api/sales?month=${month}&userId=${user?.id}`),
      fetch("/api/refunds"),
    ]);
    if (dayRes.ok) setSales(await dayRes.json());
    if (monthRes.ok) setMonthlySales(await monthRes.json());
    if (refRes.ok) setMonthRefunds(await refRes.json());
  }, [user?.id]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) router.push("/login");
        else setUser(d.user);
      });
    fetch("/api/packages")
      .then((r) => r.json())
      .then(setPackages);
  }, [router]);

  useEffect(() => {
    if (user) loadSales();
  }, [user, loadSales]);

  const priceNum = Number(formPrice) || 0;
  const totalPrice = priceNum - discount;
  const todayTotal = sales.reduce((s, sale) => s + sale.totalPrice, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (priceNum <= 0) return;
    setLoading(true);
    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personCount: formPersonCount,
        duration: formDuration,
        packageType: formPackageType,
        unitPrice: priceNum,
        discount,
        discountReason: discountReason || undefined,
        customerType,
        customerNote: customerNote || undefined,
      }),
    });
    if (res.ok) {
      await loadSales();
      setShowForm(false);
      setFormPersonCount(1);
      setFormDuration("yearly");
      setFormPackageType("individual");
      setFormPrice("");
      setDiscount(0);
      setDiscountReason("");
      setCustomerNote("");
    }
    setLoading(false);
  }

  async function handleEditPrice(saleId: string) {
    const newPrice = Number(editPrice);
    if (!newPrice || newPrice <= 0) return;
    const res = await fetch("/api/sales", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: saleId, unitPrice: newPrice }),
    });
    if (res.ok) {
      setEditingSaleId(null);
      setEditPrice("");
      await loadSales();
    }
  }

  async function handleDeleteRequest(saleId: string) {
    const reason = prompt("Silme sebebini yazın:");
    if (!reason) return;
    await fetch(`/api/sales/${saleId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    await loadSales();
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg("");
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    });
    const data = await res.json();
    if (res.ok) {
      setPwMsg("Şifre başarıyla değiştirildi!");
      setCurrentPw("");
      setNewPw("");
      setTimeout(() => { setShowPassword(false); setPwMsg(""); }, 2000);
    } else {
      setPwMsg(data.error || "Hata oluştu");
    }
  }

  async function copyToClipboard(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopiedLink(id);
    setTimeout(() => setCopiedLink(null), 2000);
  }

  const grouped = packages.reduce<Record<string, Package[]>>((acc, p) => {
    const key = p.product.name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  function renderSaleInfo(sale: Sale) {
    const typeLbl = TYPE_LABELS[sale.packageType] || sale.packageType;
    const durLbl = DURATION_LABELS[sale.duration] || sale.duration;
    return `${sale.personCount} Kişi • ${durLbl} • ${typeLbl}`;
  }

  if (!user) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Merhaba, {user.name} 👋</h1>
            <p className="text-sm text-slate-400">Bugünkü satışların</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowPassword(!showPassword)} className="px-4 py-2 bg-slate-600/30 text-slate-300 rounded-lg text-sm hover:bg-slate-600/50 transition">
              🔑 Şifre
            </button>
            <a href="/dashboard" className="px-4 py-2 bg-purple-600/30 text-purple-300 rounded-lg text-sm hover:bg-purple-600/50 transition">
              📊 Dashboard
            </a>
            <button onClick={handleLogout} className="px-4 py-2 bg-red-600/30 text-red-300 rounded-lg text-sm hover:bg-red-600/50 transition">
              Çıkış
            </button>
          </div>
        </div>
      </header>

      {/* Password Change */}
      {showPassword && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <form onSubmit={handleChangePassword} className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <h3 className="text-sm font-bold text-white mb-3">Şifre Değiştir</h3>
            <div className="flex gap-3 items-end">
              <input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                placeholder="Mevcut şifre"
                required
              />
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                placeholder="Yeni şifre (min 6 karakter)"
                required
                minLength={6}
              />
              <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition">
                Değiştir
              </button>
            </div>
            {pwMsg && <p className={`text-xs mt-2 ${pwMsg.includes("başarı") ? "text-green-400" : "text-red-400"}`}>{pwMsg}</p>}
          </form>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Today & Month Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 border border-green-500/30 rounded-2xl p-4">
            <p className="text-green-400 text-xs font-medium">Bugün Toplam</p>
            <p className="text-2xl font-bold text-white mt-1">
              {new Intl.NumberFormat("tr-TR").format(todayTotal)} ₺
            </p>
          </div>
          <div className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border border-blue-500/30 rounded-2xl p-4">
            <p className="text-blue-400 text-xs font-medium">Bu Ay Toplam</p>
            <p className="text-2xl font-bold text-white mt-1">
              {new Intl.NumberFormat("tr-TR").format(monthlySales.reduce((s, sale) => s + sale.totalPrice, 0))} ₺
            </p>
          </div>
          <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-2xl p-4">
            <p className="text-purple-400 text-xs font-medium">Ay Satış Adedi</p>
            <p className="text-2xl font-bold text-white mt-1">{monthlySales.length}</p>
          </div>
        </div>

        {/* Refund Notice */}
        {monthRefunds.length > 0 && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-red-300 font-medium text-sm">↩️ Bu Ay İadeler</span>
              <span className="text-red-400 font-bold">-{new Intl.NumberFormat("tr-TR").format(monthRefunds.reduce((s, r) => s + r.amount, 0))} ₺</span>
            </div>
            <div className="text-sm text-slate-400">
              Net Ciro: <span className="text-green-400 font-bold">
                {new Intl.NumberFormat("tr-TR").format(monthlySales.reduce((s, sale) => s + sale.totalPrice, 0) - monthRefunds.reduce((s, r) => s + r.amount, 0))} ₺
              </span>
            </div>
            {monthRefunds.map((r) => (
              <div key={r.id} className="flex items-center justify-between mt-2 pt-2 border-t border-red-500/20 text-xs">
                <span className="text-slate-400">{new Date(r.createdAt).toLocaleDateString("tr-TR")} — {r.reason}</span>
                <span className="text-red-400">-{new Intl.NumberFormat("tr-TR").format(r.amount)} ₺</span>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => { setShowForm(!showForm); if (!showForm) setShowPayment(false); }}
            className={`py-4 font-bold text-lg rounded-2xl transition-all shadow-lg ${
              showForm
                ? "bg-slate-700 text-slate-300"
                : "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-purple-500/25 hover:from-purple-700 hover:to-pink-700"
            }`}
          >
            {showForm ? "✕ İptal" : "＋ Yeni Satış"}
          </button>
          <button
            onClick={() => { setShowPayment(!showPayment); if (!showPayment) setShowForm(false); }}
            className={`py-4 font-bold text-lg rounded-2xl transition-all shadow-lg ${
              showPayment
                ? "bg-slate-700 text-slate-300"
                : "bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-amber-500/25 hover:from-amber-700 hover:to-orange-700"
            }`}
          >
            {showPayment ? "✕ Kapat" : "💳 Ödeme Linkleri"}
          </button>
        </div>

        {/* Payment Links */}
        {showPayment && (
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 mb-6 space-y-6">
            <h3 className="text-lg font-bold text-amber-300">💳 Ödeme Linkleri</h3>
            {Object.entries(grouped).map(([productName, pkgs]) => {
              const hasLinks = pkgs.some((p) => p.paymentLinkPayTR || p.paymentLinkSuperead);
              if (!hasLinks) return null;
              return (
                <div key={productName}>
                  <h4 className="text-purple-300 font-semibold text-sm mb-3 border-b border-white/10 pb-2">{productName}</h4>
                  <div className="space-y-2">
                    {pkgs.map((p) => {
                      if (!p.paymentLinkPayTR && !p.paymentLinkSuperead) return null;
                      return (
                        <div key={p.id} className="bg-white/5 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-white font-medium text-sm">{p.name}</span>
                            <span className="text-amber-400 font-bold text-sm">{new Intl.NumberFormat("tr-TR").format(p.basePrice)} ₺</span>
                          </div>
                          <div className="flex gap-2">
                            {p.paymentLinkPayTR && (
                              <button
                                onClick={() => copyToClipboard(p.paymentLinkPayTR!, `paytr-${p.id}`)}
                                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                                  copiedLink === `paytr-${p.id}`
                                    ? "bg-green-600/30 text-green-300 border border-green-500/30"
                                    : "bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30"
                                }`}
                              >
                                {copiedLink === `paytr-${p.id}` ? "Kopyalandı!" : "PayTR Linki Kopyala"}
                              </button>
                            )}
                            {p.paymentLinkSuperead && (
                              <button
                                onClick={() => copyToClipboard(p.paymentLinkSuperead!, `super-${p.id}`)}
                                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                                  copiedLink === `super-${p.id}`
                                    ? "bg-green-600/30 text-green-300 border border-green-500/30"
                                    : "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30"
                                }`}
                              >
                                {copiedLink === `super-${p.id}` ? "Kopyalandı!" : "Superead Linki Kopyala"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Bank Info */}
            <div className="mt-6 pt-6 border-t border-white/10">
              <h4 className="text-purple-300 font-semibold text-sm mb-3">🏦 Banka Hesap Bilgileri</h4>
              <p className="text-xs text-slate-400 mb-3">Alıcı Adı: <span className="text-white font-medium">Superead Yazılım A.Ş.</span></p>
              <div className="space-y-2">
                {[
                  { bank: "Garanti Bankası", iban: "TR87 0006 2000 7650 0006 2939 28" },
                  { bank: "Kuveyt Türk", iban: "TR43 0020 5000 0992 8144 8000 01" },
                  { bank: "Ziraat Bankası", iban: "TR72 0001 0010 0097 8348 6250 01" },
                ].map((b) => (
                  <div key={b.bank} className="bg-white/5 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <span className="text-white text-sm font-medium">{b.bank}</span>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{b.iban}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(b.iban, `iban-${b.bank}`)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        copiedLink === `iban-${b.bank}`
                          ? "bg-green-600/30 text-green-300 border border-green-500/30"
                          : "bg-purple-600/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600/30"
                      }`}
                    >
                      {copiedLink === `iban-${b.bank}` ? "Kopyalandı!" : "IBAN Kopyala"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Sale Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 mb-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Kişi Sayısı */}
              <div>
                <label className="block text-purple-300 text-sm font-medium mb-2">Kişi Sayısı</label>
                <select
                  value={formPersonCount}
                  onChange={(e) => setFormPersonCount(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:outline-none appearance-none"
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n} className="bg-slate-800">{n} Kişi</option>
                  ))}
                </select>
              </div>

              {/* Paket Süresi */}
              <div>
                <label className="block text-purple-300 text-sm font-medium mb-2">Paket Süresi</label>
                <select
                  value={formDuration}
                  onChange={(e) => setFormDuration(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:outline-none appearance-none"
                >
                  <option value="monthly" className="bg-slate-800">Aylık</option>
                  <option value="3month" className="bg-slate-800">3 Aylık</option>
                  <option value="yearly" className="bg-slate-800">Yıllık</option>
                  <option value="lifetime" className="bg-slate-800">Ömürlük</option>
                </select>
              </div>
            </div>

            {/* Paket Türü */}
            <div>
              <label className="block text-purple-300 text-sm font-medium mb-2">Paket Türü</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "instructor", label: "👩‍🏫 Eğitmen" },
                  { value: "individual", label: "👤 Bireysel" },
                ].map((pt) => (
                  <button
                    key={pt.value}
                    type="button"
                    onClick={() => setFormPackageType(pt.value)}
                    className={`py-3 rounded-xl text-base font-medium transition-all ${
                      formPackageType === pt.value
                        ? "bg-purple-600 text-white border-2 border-purple-400"
                        : "bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {pt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fiyat */}
            <div>
              <label className="block text-purple-300 text-sm font-medium mb-2">Fiyat (₺)</label>
              <input
                type="number"
                min={1}
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                placeholder="Örn: 4999"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            {/* İndirim */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-purple-300 text-sm font-medium mb-2">İndirim (₺)</label>
                <input
                  type="number"
                  min={0}
                  value={discount || ""}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
              {discount > 0 && (
                <div>
                  <label className="block text-purple-300 text-sm font-medium mb-2">İndirim Sebebi</label>
                  <input
                    type="text"
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    placeholder="Neden?"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Müşteri Tipi */}
            <div>
              <label className="block text-purple-300 text-sm font-medium mb-2">Müşteri Tipi</label>
              <div className="flex gap-2">
                {[
                  { value: "new", label: "🆕 Yeni" },
                  { value: "renewal", label: "🔄 Yenileme" },
                  { value: "upgrade", label: "⬆️ Upgrade" },
                ].map((ct) => (
                  <button
                    key={ct.value}
                    type="button"
                    onClick={() => setCustomerType(ct.value)}
                    className={`flex-1 py-2 rounded-xl text-sm transition ${
                      customerType === ct.value
                        ? "bg-purple-600 text-white"
                        : "bg-white/5 text-slate-300 border border-white/10"
                    }`}
                  >
                    {ct.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-purple-300 text-sm font-medium mb-2">Not (opsiyonel)</label>
              <input
                type="text"
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                placeholder="Ek bilgi..."
              />
            </div>

            {/* Total Preview */}
            {priceNum > 0 && (
              <div className="bg-green-600/20 border border-green-500/30 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <span className="text-green-300">Toplam Tutar</span>
                  <span className="text-2xl font-bold text-white">
                    {new Intl.NumberFormat("tr-TR").format(totalPrice)} ₺
                  </span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={priceNum <= 0 || loading}
              className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl disabled:opacity-50 transition-all hover:from-green-700 hover:to-emerald-700"
            >
              {loading ? "Kaydediliyor..." : "✓ Satışı Kaydet"}
            </button>
          </form>
        )}

        {/* Sales List */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMonthly(false)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                !showMonthly ? "bg-purple-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"
              }`}
            >
              Bugün ({sales.length})
            </button>
            <button
              onClick={() => setShowMonthly(true)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                showMonthly ? "bg-purple-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"
              }`}
            >
              Bu Ay ({monthlySales.length})
            </button>
          </div>

          {(() => {
            const displaySales = showMonthly ? monthlySales : sales;
            if (displaySales.length === 0) {
              return (
                <div className="bg-white/5 rounded-2xl p-8 text-center text-slate-400">
                  {showMonthly ? "Bu ay henüz satış yok." : "Henüz satış yok. İlk satışını ekle!"}
                </div>
              );
            }
            return displaySales.map((sale) => (
              <div
                key={sale.id}
                className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-white font-medium">{renderSaleInfo(sale)}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {showMonthly
                        ? new Date(sale.createdAt).toLocaleDateString("tr-TR") + " " + new Date(sale.createdAt).toLocaleTimeString("tr-TR")
                        : new Date(sale.createdAt).toLocaleTimeString("tr-TR")}
                      {sale.customerType === "renewal" && " 🔄"}
                      {sale.customerType === "upgrade" && " ⬆️"}
                      {sale.discount > 0 && ` • ${new Intl.NumberFormat("tr-TR").format(sale.discount)}₺ indirim`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingSaleId === sale.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-24 px-2 py-1 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                          placeholder="Yeni fiyat"
                          autoFocus
                        />
                        <button
                          onClick={() => handleEditPrice(sale.id)}
                          className="px-2 py-1 bg-green-600/30 text-green-300 rounded-lg text-xs hover:bg-green-600/50 transition"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => { setEditingSaleId(null); setEditPrice(""); }}
                          className="px-2 py-1 bg-red-600/30 text-red-300 rounded-lg text-xs hover:bg-red-600/50 transition"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingSaleId(sale.id); setEditPrice(String(sale.unitPrice)); }}
                        className="text-lg font-bold text-green-400 hover:text-green-300 transition cursor-pointer"
                        title="Fiyatı düzenle"
                      >
                        {new Intl.NumberFormat("tr-TR").format(sale.totalPrice)} ₺
                      </button>
                    )}
                    {sale.deletionRequest ? (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        sale.deletionRequest.status === "pending"
                          ? "bg-yellow-500/20 text-yellow-300"
                          : sale.deletionRequest.status === "rejected"
                          ? "bg-red-500/20 text-red-300"
                          : "bg-green-500/20 text-green-300"
                      }`}>
                        {sale.deletionRequest.status === "pending" ? "Onay Bekliyor" : sale.deletionRequest.status === "rejected" ? "Reddedildi" : "Silindi"}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleDeleteRequest(sale.id)}
                        className="text-red-400/50 hover:text-red-400 transition text-sm"
                        title="Silme talebi gönder"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>
      </main>
    </div>
  );
}
