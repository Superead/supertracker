"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { useRouter } from "next/navigation";

type Donem = { lead: number; satis: number; ciro: number; donusum: number | null; sepet: number | null; ilkCevapMedyan: number | null; cevap10: number | null; cevap60: number | null; ilkCevapSayisi: number; cevapMedyan: number | null; cevapSayisi: number; yazanMusteri: number; satisciMesaj: number; cevapsizBirakilan: number };
type Grup = Donem & {
  kommoUserId: number;
  grup: string;
  uyeler: { id: string; name: string }[];
  once: Donem;
  seri: { gun: string; satis: number; ilkCevap: number | null }[];
  simdiCevapsiz: number;
  kalitePuani: number | null;
  acikKocluk: number;
};
type Cevapsiz = { leadId: number; leadAdi: string; kommoUserId: number; grup: string; bekleyenDk: number; yazdigi: string };
type Ornek = { leadId?: number; metin?: string; aciklama?: string; ifade?: string; kural?: string };
type Kalite = {
  kommoUserId: number;
  grup: string;
  puanlar?: Record<string, number>;
  ozet?: string;
  guclu?: string[];
  zayif?: string[];
  iyiOrnekler?: Ornek[];
  zayifOrnekler?: Ornek[];
  ihlaller?: Ornek[];
  oneriler?: string[];
  ortakSorunlar?: string[];
  orneklem?: { kazanilan?: number; kaybedilen?: number };
};
type Kocluk = { id: string; kommoUserId: number; grup: string; metin: string; durum: string; hedefTarih: string | null; olusturan: string; createdAt: string; tamamlandi: string | null };
type Veri = {
  donem: { bas: string; bit: string; gun: number };
  ozet: { satis: number; ciro: number; lead: number; donusum: number | null; ilkCevapMedyan: number | null; cevap10: number | null; simdiCevapsiz: number; once: { satis: number; ciro: number; lead: number } };
  gruplar: Grup[];
  cevapsiz: Cevapsiz[];
  cevapsizGuncelleme: string | null;
  sonGuncelleme: string | null;
  veriBaslangici: string | null;
  kalite: { hafta: string | null; haftalar: string[]; raporlar: Kalite[] };
  kocluk: Kocluk[];
};
type Mudur = { id: string; name: string; email: string; isActive: boolean };

const KRITER: [string, string][] = [
  ["hiz", "Hız ve takip"],
  ["ihtiyac", "İhtiyaç analizi"],
  ["deger", "Değer anlatımı"],
  ["fiyat", "Fiyat ve kampanya"],
  ["itiraz", "İtiraz karşılama"],
  ["kapanis", "Kapanış"],
  ["uslup", "Üslup ve doğruluk"],
];
const KOMMO = "https://mehmettashanligil.kommo.com/leads/detail/";
const input = "px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none";
const tl = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + " ₺";
const dkYaz = (d: number | null) => (d === null ? "—" : d < 60 ? `${d} dk` : `${Math.floor(d / 60)} sa ${d % 60} dk`);
const tarih = (s: string) => {
  const [y, m, g] = s.split("-");
  return `${g}.${m}.${y}`;
};
const saatOnce = (iso: string | null) => {
  if (!iso) return "henüz yok";
  return new Date(iso).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

/** İyi/kötü eşiğine göre renk: iyi → yeşil, kötü → kırmızı. */
function renk(v: number | null, iyi: number, kotu: number, buyukIyi: boolean) {
  if (v === null) return "text-slate-500";
  if (buyukIyi ? v >= iyi : v <= iyi) return "text-emerald-300";
  if (buyukIyi ? v < kotu : v > kotu) return "text-red-300";
  return "text-amber-200";
}

function Degisim({ simdi, once, para }: { simdi: number; once: number; para?: boolean }) {
  if (!once && !simdi) return null;
  const fark = simdi - once;
  if (fark === 0) return <span className="text-xs text-slate-500">→</span>;
  const yuzde = once ? Math.round((fark / once) * 100) : null;
  return (
    <span className={`text-xs ${fark > 0 ? "text-emerald-400" : "text-red-400"}`}>
      {fark > 0 ? "▲" : "▼"} {yuzde !== null ? `%${Math.abs(yuzde)}` : para ? tl(Math.abs(fark)) : Math.abs(fark)}
    </span>
  );
}

function Seri({ seri }: { seri: { satis: number }[] }) {
  if (seri.length < 2) return null;
  const max = Math.max(1, ...seri.map((s) => s.satis));
  const w = 4;
  return (
    <svg width={seri.length * (w + 1)} height="22" className="inline-block align-middle" aria-hidden>
      {seri.map((s, i) => (
        <rect key={i} x={i * (w + 1)} y={22 - (s.satis / max) * 20 - 1} width={w} height={(s.satis / max) * 20 + 1} rx="1" fill={s.satis ? "#34d399" : "#475569"} />
      ))}
    </svg>
  );
}

function Kart({ baslik, deger, alt, cls }: { baslik: string; deger: React.ReactNode; alt?: React.ReactNode; cls?: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="text-xs text-slate-400">{baslik}</div>
      <div className={`text-2xl font-bold mt-1 ${cls || "text-white"}`}>{deger}</div>
      {alt && <div className="text-xs text-slate-400 mt-1">{alt}</div>}
    </div>
  );
}

export default function SatisKarnesi() {
  const router = useRouter();
  const [me, setMe] = useState<{ name: string; role: string } | null>(null);
  const [gun, setGun] = useState(7);
  const [hafta, setHafta] = useState<string | null>(null);
  const [veri, setVeri] = useState<Veri | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [yenile, setYenile] = useState(0);
  const [acik, setAcik] = useState<number | null>(null);
  const [cevapsizHepsi, setCevapsizHepsi] = useState(false);
  const [cevapsizGrup, setCevapsizGrup] = useState<number | 0>(0);
  const [yeniGorev, setYeniGorev] = useState<{ metin: string; hedefTarih: string }>({ metin: "", hedefTarih: "" });
  const [guncelleniyor, setGuncelleniyor] = useState(false);
  const [showAyar, setShowAyar] = useState(false);
  const [mudurler, setMudurler] = useState<Mudur[]>([]);
  const [yeniMudur, setYeniMudur] = useState({ name: "", email: "", password: "" });
  const [mesaj, setMesaj] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.user) router.push("/login");
        else if (d.user.role !== "admin" && d.user.role !== "manager") router.push("/");
        else setMe({ name: d.user.name, role: d.user.role });
      });
  }, [router]);

  useEffect(() => {
    let aktif = true;
    const q = new URLSearchParams({ gun: String(gun) });
    if (hafta) q.set("hafta", hafta);
    fetch(`/api/satis-karne?${q}`)
      .then(async (r) => {
        const d = await r.json();
        if (!aktif) return;
        if (!r.ok) setHata(d.error || "Yüklenemedi");
        else {
          setVeri(d);
          setHata(null);
        }
      })
      .catch(() => aktif && setHata("Yüklenemedi"));
    return () => {
      aktif = false;
    };
  }, [gun, hafta, yenile]);

  const mudurYukle = useCallback(async () => {
    const r = await fetch("/api/satis-karne/ayarlar");
    if (r.ok) setMudurler((await r.json()).mudurler);
  }, []);

  async function simdiGuncelle(gecmis?: number) {
    setGuncelleniyor(true);
    setMesaj(null);
    const r = await fetch(`/api/satis-karne/guncelle${gecmis ? `?gecmis=${gecmis}` : ""}`, { method: "POST" });
    const d = await r.json().catch(() => ({}));
    setGuncelleniyor(false);
    if (!r.ok) setMesaj(d.error || "Güncellenemedi");
    else {
      setMesaj(gecmis ? `Güncellendi. Son ${gecmis} gün arka planda dolduruluyor; birkaç dakika sonra sayfayı yenileyin.` : "Güncellendi.");
      setYenile((x) => x + 1);
    }
  }

  async function gorevEkle(g: Grup) {
    if (!yeniGorev.metin.trim()) return;
    const r = await fetch("/api/satis-karne/kocluk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kommoUserId: g.kommoUserId, grup: g.grup, ...yeniGorev }),
    });
    if (r.ok) {
      setYeniGorev({ metin: "", hedefTarih: "" });
      setYenile((x) => x + 1);
    }
  }

  async function gorevDurum(k: Kocluk) {
    await fetch("/api/satis-karne/kocluk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: k.id, durum: k.durum === "acik" ? "tamam" : "acik" }),
    });
    setYenile((x) => x + 1);
  }

  async function gorevSil(k: Kocluk) {
    if (!confirm("Görev silinsin mi?")) return;
    await fetch(`/api/satis-karne/kocluk?id=${k.id}`, { method: "DELETE" });
    setYenile((x) => x + 1);
  }

  async function mudurKaydet(body: object) {
    const r = await fetch("/api/satis-karne/ayarlar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) {
      alert(d.error || "Kaydedilemedi");
      return false;
    }
    await mudurYukle();
    return true;
  }

  async function cikis() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const genel = veri?.kalite.raporlar.find((k) => k.kommoUserId === 0);
  const kaliteGrup = (kid: number) => veri?.kalite.raporlar.find((k) => k.kommoUserId === kid);
  const cevapsizListe = (veri?.cevapsiz || []).filter((c) => !cevapsizGrup || c.kommoUserId === cevapsizGrup);
  const acikGorevler = (veri?.kocluk || []).filter((k) => k.durum === "acik");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-white">🏆 Satış Karnesi</h1>
            <p className="text-sm text-slate-400">
              Sayılar saatte bir güncellenir · son: {saatOnce(veri?.sonGuncelleme || null)}
              {veri?.kalite.hafta ? ` · kalite raporu: ${tarih(veri.kalite.hafta)} haftası` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-white/5 rounded-lg p-1">
              {[
                [1, "Bugün"],
                [7, "7 gün"],
                [30, "30 gün"],
              ].map(([n, ad]) => (
                <button key={n} onClick={() => setGun(n as number)} className={`px-3 py-1.5 rounded-md text-sm ${gun === n ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-white/10"}`}>
                  {ad}
                </button>
              ))}
            </div>
            {me?.role === "admin" && (
              <>
                <button disabled={guncelleniyor} onClick={() => simdiGuncelle()} className="px-3 py-2 bg-emerald-600/30 text-emerald-300 rounded-lg text-sm hover:bg-emerald-600/50 disabled:opacity-50">
                  {guncelleniyor ? "Güncelleniyor…" : "↻ Şimdi güncelle"}
                </button>
                <button onClick={() => { setShowAyar(!showAyar); if (!showAyar) mudurYukle(); }} className="px-3 py-2 bg-purple-600/30 text-purple-300 rounded-lg text-sm hover:bg-purple-600/50">
                  ⚙️ Ayarlar
                </button>
                <a href="/admin" className="px-3 py-2 bg-slate-600/30 text-slate-300 rounded-lg text-sm hover:bg-slate-600/50">← Admin</a>
              </>
            )}
            <button onClick={cikis} className="px-3 py-2 bg-red-600/30 text-red-300 rounded-lg text-sm hover:bg-red-600/50">Çıkış</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {mesaj && <div className="bg-emerald-600/10 border border-emerald-500/20 text-emerald-200 rounded-xl px-4 py-3 text-sm">{mesaj}</div>}
        {hata && <div className="bg-red-600/10 border border-red-500/20 text-red-200 rounded-xl px-4 py-3 text-sm">{hata}</div>}

        {showAyar && me?.role === "admin" && (
          <section className="bg-purple-600/10 border border-purple-500/20 rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-white font-semibold mb-1">Satış müdürü hesapları</h2>
              <p className="text-xs text-slate-400 mb-3">Müdür bu sayfayı görür, koçluk görevi ekler ve kapatır. Admin paneline erişemez.</p>
              <div className="space-y-2 mb-3">
                {mudurler.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2 text-sm">
                    <span className="text-white font-medium">{m.name}</span>
                    <span className="text-slate-400 text-xs">{m.email}</span>
                    <span className={`text-xs ${m.isActive ? "text-emerald-300" : "text-slate-500"}`}>{m.isActive ? "aktif" : "kapalı"}</span>
                    <button onClick={() => mudurKaydet({ action: "mudur-durum", id: m.id, isActive: !m.isActive })} className="ml-auto px-3 py-1 bg-white/10 text-slate-300 rounded-lg text-xs hover:bg-white/20">
                      {m.isActive ? "Kapat" : "Aç"}
                    </button>
                  </div>
                ))}
                {!mudurler.length && <p className="text-sm text-slate-500">Henüz müdür hesabı yok.</p>}
              </div>
              <div className="flex gap-2 flex-wrap">
                <input value={yeniMudur.name} onChange={(e) => setYeniMudur({ ...yeniMudur, name: e.target.value })} placeholder="Ad Soyad" className={input} />
                <input value={yeniMudur.email} onChange={(e) => setYeniMudur({ ...yeniMudur, email: e.target.value })} placeholder="E-posta" className={input} />
                <input type="password" value={yeniMudur.password} onChange={(e) => setYeniMudur({ ...yeniMudur, password: e.target.value })} placeholder="Şifre (en az 6)" className={input} />
                <button onClick={async () => { if (await mudurKaydet({ action: "mudur", ...yeniMudur })) setYeniMudur({ name: "", email: "", password: "" }); }} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
                  Müdür ekle
                </button>
              </div>
            </div>
            <div className="border-t border-white/10 pt-4">
              <h2 className="text-white font-semibold mb-1">Geçmiş veriyi doldur</h2>
              <p className="text-xs text-slate-400 mb-3">
                Cevap süreleri sayfa açıldığından beri birikiyor{veri?.veriBaslangici ? ` (ilk gün: ${tarih(veri.veriBaslangici)})` : ""}. Son 30 günü Kommo&apos;dan bir kez çekmek birkaç dakika sürer.
              </p>
              <button disabled={guncelleniyor} onClick={() => simdiGuncelle(30)} className="px-4 py-2 bg-white/10 text-slate-200 rounded-lg text-sm hover:bg-white/20 disabled:opacity-50">
                Son 30 günü doldur
              </button>
            </div>
          </section>
        )}

        {!veri && !hata && <p className="text-slate-400">Yükleniyor…</p>}

        {veri && (
          <>
            {/* Özet */}
            <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Kart baslik="Satış" deger={veri.ozet.satis} alt={<><Degisim simdi={veri.ozet.satis} once={veri.ozet.once.satis} /> önceki {veri.donem.gun} güne göre</>} />
              <Kart baslik="Ciro" deger={tl(veri.ozet.ciro)} alt={<><Degisim simdi={veri.ozet.ciro} once={veri.ozet.once.ciro} para /> önceki döneme göre</>} />
              <Kart baslik="Lead → satış" deger={veri.ozet.donusum === null ? "—" : `%${veri.ozet.donusum}`} alt={`${veri.ozet.lead} yeni lead · hedef %10`} cls={renk(veri.ozet.donusum, 10, 5, true)} />
               <Kart baslik="Yeni lead'e ilk cevap" deger={dkYaz(veri.ozet.ilkCevapMedyan)} alt="medyan, mesai içi · hedef 10 dk" cls={renk(veri.ozet.ilkCevapMedyan, 10, 30, false)} />
               <Kart baslik="10 dk içinde ilk cevap" deger={veri.ozet.cevap10 === null ? "—" : `%${veri.ozet.cevap10}`} alt="yeni lead'lerin" cls={renk(veri.ozet.cevap10, 70, 40, true)} />
              <Kart baslik="Şu an cevapsız" deger={veri.ozet.simdiCevapsiz} alt={`müşteri · ${saatOnce(veri.cevapsizGuncelleme)}`} cls={veri.ozet.simdiCevapsiz ? "text-red-300" : "text-emerald-300"} />
            </section>

            {/* Cevapsız müşteriler */}
            <section className="bg-red-600/10 border border-red-500/20 rounded-2xl p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                <div>
                  <h2 className="text-white font-semibold">🔴 Cevap bekleyen müşteriler</h2>
                  <p className="text-xs text-slate-400">Son mesajı müşteriden gelen ve 30 mesai dakikasından uzun süredir satışçı cevabı almamış konuşmalar (bot mesajları cevap sayılmaz).</p>
                </div>
                <select value={cevapsizGrup} onChange={(e) => setCevapsizGrup(Number(e.target.value))} className={input}>
                  <option value={0}>Tüm gruplar</option>
                  {veri.gruplar.map((g) => (
                    <option key={g.kommoUserId} value={g.kommoUserId}>{g.grup} ({g.simdiCevapsiz})</option>
                  ))}
                </select>
              </div>
              {cevapsizListe.length === 0 ? (
                <p className="text-sm text-emerald-300">Cevap bekleyen müşteri yok.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-400 text-xs">
                        <th className="py-1 pr-3">Grup</th>
                        <th className="py-1 pr-3">Müşteri</th>
                        <th className="py-1 pr-3">Yazdığı an</th>
                        <th className="py-1">Bekliyor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(cevapsizHepsi ? cevapsizListe : cevapsizListe.slice(0, 12)).map((c) => (
                        <tr key={c.leadId} className="border-t border-white/5">
                          <td className="py-1.5 pr-3 text-slate-300">{c.grup}</td>
                          <td className="py-1.5 pr-3">
                            <a href={KOMMO + c.leadId} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">{c.leadAdi.slice(0, 50)}</a>
                          </td>
                          <td className="py-1.5 pr-3 text-slate-400">{saatOnce(c.yazdigi)}</td>
                          <td className={`py-1.5 font-medium ${c.bekleyenDk > 120 ? "text-red-300" : "text-amber-200"}`}>{dkYaz(c.bekleyenDk)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {cevapsizListe.length > 12 && (
                    <button onClick={() => setCevapsizHepsi(!cevapsizHepsi)} className="mt-2 text-xs text-slate-300 hover:underline">
                      {cevapsizHepsi ? "Daha az göster" : `Tümünü göster (${cevapsizListe.length})`}
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* Grup tablosu */}
            <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h2 className="text-white font-semibold">Gruplar</h2>
              <p className="text-xs text-slate-400 mb-3">
                {tarih(veri.donem.bas)} – {tarih(veri.donem.bit)} · satış ve ciro SuperTracker kayıtlarından, lead ve cevap süreleri Kommo&apos;dan. Ayrıntı ve koçluk için gruba tıklayın.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 text-xs">
                      <th className="py-2 pr-3">Grup</th>
                      <th className="py-2 pr-3">Satış</th>
                      <th className="py-2 pr-3">Ciro</th>
                      <th className="py-2 pr-3">Lead</th>
                      <th className="py-2 pr-3">Dönüşüm</th>
                      <th className="py-2 pr-3">Sepet</th>
                      <th className="py-2 pr-3" title="Yeni lead'in ilk mesajına satışçının ilk cevabı (medyan, mesai dakikası)">İlk cevap</th>
                      <th className="py-2 pr-3" title="İlk cevabın 10 dakika / 1 saat içinde verildiği yeni lead oranı">10 dk / 1 sa</th>
                      <th className="py-2 pr-3" title="Konuşma içindeki tüm müşteri mesajlarına cevap süresi (medyan)">Sohbet cevabı</th>
                      <th className="py-2 pr-3">Cevapsız</th>
                      <th className="py-2 pr-3">Kalite</th>
                      <th className="py-2 pr-3">Koçluk</th>
                      <th className="py-2">Günlük satış</th>
                    </tr>
                  </thead>
                  <tbody>
                    {veri.gruplar.map((g) => {
                      const k = kaliteGrup(g.kommoUserId);
                      const gorevler = veri.kocluk.filter((x) => x.kommoUserId === g.kommoUserId);
                      return (
                        <Fragment key={g.kommoUserId}>
                          <tr onClick={() => setAcik(acik === g.kommoUserId ? null : g.kommoUserId)} className={`border-t border-white/5 cursor-pointer hover:bg-white/5 ${acik === g.kommoUserId ? "bg-white/5" : ""}`}>
                            <td className="py-2 pr-3">
                              <div className="text-white font-medium">{acik === g.kommoUserId ? "▾" : "▸"} {g.grup}</div>
                              <div className="text-xs text-slate-500">{g.uyeler.map((u) => u.name).join(", ")}</div>
                            </td>
                            <td className="py-2 pr-3 text-white">
                              {g.satis} <Degisim simdi={g.satis} once={g.once.satis} />
                            </td>
                            <td className="py-2 pr-3 text-slate-200">{tl(g.ciro)}</td>
                            <td className="py-2 pr-3 text-slate-300">{g.lead}</td>
                            <td className={`py-2 pr-3 ${renk(g.donusum, 10, 5, true)}`}>{g.donusum === null ? "—" : `%${g.donusum}`}</td>
                            <td className="py-2 pr-3 text-slate-300">{g.sepet ? tl(g.sepet) : "—"}</td>
                            <td className={`py-2 pr-3 ${renk(g.ilkCevapMedyan, 10, 30, false)}`}>{dkYaz(g.ilkCevapMedyan)}</td>
                            <td className="py-2 pr-3">
                              <span className={renk(g.cevap10, 70, 40, true)}>{g.cevap10 === null ? "—" : `%${g.cevap10}`}</span>
                              <span className="text-slate-500"> / </span>
                              <span className={renk(g.cevap60, 85, 60, true)}>{g.cevap60 === null ? "—" : `%${g.cevap60}`}</span>
                            </td>
                            <td className={`py-2 pr-3 ${renk(g.cevapMedyan, 5, 20, false)}`}>{dkYaz(g.cevapMedyan)}</td>
                            <td className={`py-2 pr-3 ${g.simdiCevapsiz ? "text-red-300" : "text-emerald-300"}`}>{g.simdiCevapsiz}</td>
                            <td className={`py-2 pr-3 ${renk(g.kalitePuani, 25, 18, true)}`}>{g.kalitePuani === null ? "—" : `${g.kalitePuani}/35`}</td>
                            <td className="py-2 pr-3 text-slate-300">{g.acikKocluk ? `${g.acikKocluk} açık` : "—"}</td>
                            <td className="py-2"><Seri seri={g.seri} /></td>
                          </tr>
                          {acik === g.kommoUserId && (
                            <tr>
                              <td colSpan={13} className="pb-4">
                                <div className="grid lg:grid-cols-2 gap-4 mt-2">
                                  <div className="bg-black/20 rounded-xl p-4 space-y-3">
                                    <h3 className="text-white font-semibold text-sm">Yazışma kalitesi {veri.kalite.hafta ? `(${tarih(veri.kalite.hafta)} haftası)` : ""}</h3>
                                    {!k ? (
                                      <p className="text-sm text-slate-500">Bu grup için kalite raporu yok.</p>
                                    ) : (
                                      <>
                                        <div className="space-y-1">
                                          {KRITER.map(([anahtar, ad]) => {
                                            const p = k.puanlar?.[anahtar] || 0;
                                            return (
                                              <div key={anahtar} className="flex items-center gap-2 text-xs">
                                                <span className="w-32 text-slate-400">{ad}</span>
                                                <div className="flex-1 h-2 bg-white/10 rounded">
                                                  <div className={`h-2 rounded ${p >= 4 ? "bg-emerald-400" : p >= 3 ? "bg-amber-300" : "bg-red-400"}`} style={{ width: `${p * 20}%` }} />
                                                </div>
                                                <span className="w-6 text-right text-slate-300">{p}</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                        {k.ozet && <p className="text-sm text-slate-300">{k.ozet}</p>}
                                        <div className="grid sm:grid-cols-2 gap-3 text-sm">
                                          <div>
                                            <div className="text-emerald-300 text-xs font-semibold mb-1">Güçlü yönler</div>
                                            <ul className="list-disc pl-4 text-slate-300 space-y-1">{(k.guclu || []).map((x, i) => <li key={i}>{x}</li>)}</ul>
                                          </div>
                                          <div>
                                            <div className="text-red-300 text-xs font-semibold mb-1">Geliştirilecek</div>
                                            <ul className="list-disc pl-4 text-slate-300 space-y-1">{(k.zayif || []).map((x, i) => <li key={i}>{x}</li>)}</ul>
                                          </div>
                                        </div>
                                        {!!k.iyiOrnekler?.length && (
                                          <div>
                                            <div className="text-xs font-semibold text-slate-400 mb-1">Örnek iyi mesajlar</div>
                                            {k.iyiOrnekler.map((o, i) => (
                                              <blockquote key={i} className="border-l-2 border-emerald-400/50 pl-3 text-sm text-slate-300 italic mb-1">
                                                “{o.metin}” {o.leadId && <a href={KOMMO + o.leadId} target="_blank" rel="noreferrer" className="not-italic text-xs text-sky-300">#{o.leadId}</a>}
                                              </blockquote>
                                            ))}
                                          </div>
                                        )}
                                        {!!k.zayifOrnekler?.length && (
                                          <div>
                                            <div className="text-xs font-semibold text-slate-400 mb-1">Kaçırılan fırsatlar</div>
                                            <ul className="text-sm text-slate-300 space-y-1">
                                              {k.zayifOrnekler.map((o, i) => (
                                                <li key={i}>
                                                  {o.leadId && <a href={KOMMO + o.leadId} target="_blank" rel="noreferrer" className="text-sky-300 text-xs mr-1">#{o.leadId}</a>}
                                                  {o.aciklama}
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                        {!!k.ihlaller?.length && (
                                          <div className="bg-red-600/10 rounded-lg p-2">
                                            <div className="text-xs font-semibold text-red-300 mb-1">Oyun kitabı ihlalleri</div>
                                            <ul className="text-sm text-slate-300 space-y-1">
                                              {k.ihlaller.map((o, i) => (
                                                <li key={i}>
                                                  {o.leadId && <a href={KOMMO + o.leadId} target="_blank" rel="noreferrer" className="text-sky-300 text-xs mr-1">#{o.leadId}</a>}“{o.ifade}” — {o.kural}
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                      </>
                                    )}
                                    <div className="text-xs text-slate-500">
                                      Bu dönem: {g.yazanMusteri} müşteri yazdı · grubun {g.satisciMesaj} mesajı · {g.ilkCevapSayisi} yeni lead ve {g.cevapSayisi} cevap ölçüldü · {g.cevapsizBirakilan} konuşma cevapsız kaldı
                                    </div>
                                  </div>

                                  <div className="bg-black/20 rounded-xl p-4 space-y-3">
                                    <h3 className="text-white font-semibold text-sm">Koçluk görevleri</h3>
                                    <div className="space-y-2">
                                      {gorevler.length === 0 && <p className="text-sm text-slate-500">Henüz görev yok.</p>}
                                      {gorevler.map((x) => (
                                        <div key={x.id} className="flex items-start gap-2 bg-white/5 rounded-lg px-3 py-2 text-sm">
                                          <input type="checkbox" checked={x.durum === "tamam"} onChange={() => gorevDurum(x)} className="mt-1" />
                                          <div className="flex-1">
                                            <div className={x.durum === "tamam" ? "text-slate-500 line-through" : "text-slate-200"}>{x.metin}</div>
                                            <div className="text-xs text-slate-500">
                                              {x.olusturan}
                                              {x.hedefTarih ? ` · hedef ${tarih(x.hedefTarih)}` : ""}
                                              {x.tamamlandi ? ` · tamamlandı ${saatOnce(x.tamamlandi)}` : ""}
                                            </div>
                                          </div>
                                          <button onClick={() => gorevSil(x)} className="text-slate-500 hover:text-red-300 text-xs">sil</button>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="flex gap-2 flex-wrap">
                                      <input value={yeniGorev.metin} onChange={(e) => setYeniGorev({ ...yeniGorev, metin: e.target.value })} placeholder="Ör. ilk cevabı 10 dakikanın altına indir" className={`${input} flex-1 min-w-[220px]`} />
                                      <input type="date" value={yeniGorev.hedefTarih} onChange={(e) => setYeniGorev({ ...yeniGorev, hedefTarih: e.target.value })} className={input} />
                                      <button onClick={() => gorevEkle(g)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">Ekle</button>
                                    </div>
                                    {k?.zayif?.length ? (
                                      <div className="text-xs text-slate-400">
                                        Öneri: raporun “geliştirilecek” maddelerinden birini görev olarak ekleyin.
                                        {k.zayif.slice(0, 3).map((z, i) => (
                                          <button key={i} onClick={() => setYeniGorev({ ...yeniGorev, metin: z })} className="block text-left text-sky-300 hover:underline mt-1">
                                            + {z.slice(0, 110)}
                                          </button>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!veri.gruplar.length && <p className="text-sm text-slate-500 mt-2">Henüz veri yok. İlk hesaplama sunucu açıldıktan sonra birkaç dakika içinde yapılır.</p>}
            </section>

            {/* Haftalık kalite raporu - genel */}
            <section className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-white font-semibold">Haftalık yazışma kalitesi</h2>
                  <p className="text-xs text-slate-400">Her pazartesi geçen haftanın yazışmalarından örneklem okunup 7 kritere göre puanlanır (her biri 5 üzerinden, toplam 35).</p>
                </div>
                {veri.kalite.haftalar.length > 0 && (
                  <select value={veri.kalite.hafta || ""} onChange={(e) => setHafta(e.target.value)} className={input}>
                    {veri.kalite.haftalar.map((h) => (
                      <option key={h} value={h}>{tarih(h)} haftası</option>
                    ))}
                  </select>
                )}
              </div>
              {!veri.kalite.raporlar.length ? (
                <p className="text-sm text-slate-500">Henüz kalite raporu yok.</p>
              ) : (
                <>
                  {genel?.ozet && <p className="text-sm text-slate-200">{genel.ozet}</p>}
                  <div className="grid md:grid-cols-2 gap-4">
                    {!!genel?.ortakSorunlar?.length && (
                      <div>
                        <div className="text-xs font-semibold text-red-300 mb-1">Ekip genelinde sorunlar</div>
                        <ul className="list-disc pl-4 text-sm text-slate-300 space-y-1">{genel.ortakSorunlar.map((x, i) => <li key={i}>{x}</li>)}</ul>
                      </div>
                    )}
                    {!!genel?.oneriler?.length && (
                      <div>
                        <div className="text-xs font-semibold text-emerald-300 mb-1">Bu hafta yapılacaklar</div>
                        <ul className="list-disc pl-4 text-sm text-slate-300 space-y-1">{genel.oneriler.map((x, i) => <li key={i}>{x}</li>)}</ul>
                      </div>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-400 text-xs">
                          <th className="py-1 pr-3">Grup</th>
                          {KRITER.map(([a, ad]) => (
                            <th key={a} className="py-1 pr-2">{ad}</th>
                          ))}
                          <th className="py-1">Toplam</th>
                        </tr>
                      </thead>
                      <tbody>
                        {veri.kalite.raporlar
                          .filter((k) => k.kommoUserId)
                          .map((k) => ({ k, t: KRITER.reduce((s, [a]) => s + (k.puanlar?.[a] || 0), 0) }))
                          .sort((a, b) => b.t - a.t)
                          .map(({ k, t }) => (
                            <tr key={k.kommoUserId} className="border-t border-white/5">
                              <td className="py-1.5 pr-3 text-white">{k.grup}</td>
                              {KRITER.map(([a]) => {
                                const p = k.puanlar?.[a] || 0;
                                return (
                                  <td key={a} className={`py-1.5 pr-2 ${p >= 4 ? "text-emerald-300" : p >= 3 ? "text-amber-200" : "text-red-300"}`}>{p}</td>
                                );
                              })}
                              <td className={`py-1.5 font-semibold ${renk(t, 25, 18, true)}`}>{t}/35</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>

            {/* Açık koçluk görevleri */}
            <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h2 className="text-white font-semibold mb-1">Açık koçluk görevleri</h2>
              <p className="text-xs text-slate-400 mb-3">Satış müdürü haftalık rutinde grupların zayıf noktalarına görev verir; tamamlananlar grup ayrıntısında kalır.</p>
              {acikGorevler.length === 0 ? (
                <p className="text-sm text-slate-500">Açık görev yok. Bir gruba tıklayıp görev ekleyin.</p>
              ) : (
                <div className="space-y-2">
                  {[...acikGorevler]
                    .sort((a, b) => (a.hedefTarih || "9999").localeCompare(b.hedefTarih || "9999"))
                    .map((x) => (
                      <div key={x.id} className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2 text-sm">
                        <input type="checkbox" checked={false} onChange={() => gorevDurum(x)} />
                        <span className="text-slate-400 w-36 shrink-0">{x.grup}</span>
                        <span className="text-slate-200 flex-1">{x.metin}</span>
                        <span className={`text-xs ${x.hedefTarih && x.hedefTarih < veri.donem.bit ? "text-red-300" : "text-slate-500"}`}>{x.hedefTarih ? tarih(x.hedefTarih) : ""}</span>
                      </div>
                    ))}
                </div>
              )}
            </section>

            <p className="text-xs text-slate-500">
              Ölçüm notları: &quot;İlk cevap&quot;, müşterinin kendisi yazdığı yeni lead&apos;lerde ilk mesaja satışçının ilk cevabıdır (cevaplanmamışsa şimdiye kadarki bekleme sayılır). Süreler mesai içinde (09:00–21:00) sayılır; gece yazan müşterinin süresi sabah 09:00&apos;da başlar. Bot, toplu mesaj ve AI mesajları cevap sayılmaz. Telefon görüşmeleri ölçülmez. Cevap süreleri ve lead sayıları
              {veri.veriBaslangici ? ` ${tarih(veri.veriBaslangici)} tarihinden` : " ilk hesaplamadan"} beri tutuluyor.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
