"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Randevu {
  id: string;
  studentName: string;
  phone: string;
  email: string | null;
  date: string;
  time: string;
  status: string;
  meetLink: string | null;
  note: string | null;
  createdByName: string | null;
  confirmSentAt: string | null;
  confirmError: string | null;
  reminderSentAt: string | null;
  reminderError: string | null;
  calendar: { teacherName: string };
}

interface Musaitlik { calendarRefId: string; teacherName: string; slots: string[]; error?: string }
interface Takvim { id: string; teacherName: string; teacherEmail: string | null; calendarId: string; calendarName: string | null; isActive: boolean }
interface Kullanici { id: string; name: string; email: string; isActive: boolean }

const GUN = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
function trTarih(d: string) {
  const [y, m, g] = d.split("-").map(Number);
  return `${String(g).padStart(2, "0")}.${String(m).padStart(2, "0")} ${GUN[new Date(Date.UTC(y, m - 1, g)).getUTCDay()]}`;
}
const bugunTR = () => new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);
const yarinTR = () => new Date(Date.now() + 27 * 3600000).toISOString().slice(0, 10);

const DURUM: Record<string, { label: string; cls: string }> = {
  scheduled: { label: "Bekliyor", cls: "bg-blue-500/20 text-blue-300" },
  done: { label: "Yapıldı", cls: "bg-green-500/20 text-green-300" },
  noshow: { label: "Gelmedi", cls: "bg-orange-500/20 text-orange-300" },
  cancelled: { label: "İptal", cls: "bg-red-500/20 text-red-300" },
};

const input = "px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none";

export default function RandevuPage() {
  const router = useRouter();
  const [me, setMe] = useState<{ name: string; role: string } | null>(null);
  const [randevular, setRandevular] = useState<Randevu[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  // Yeni randevu formu
  const [phone, setPhone] = useState("");
  const [studentName, setStudentName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [ogrenci, setOgrenci] = useState<{ kisi: { name: string; email: string | null } | null; gecmis: Randevu[] } | null>(null);
  const [date, setDate] = useState(yarinTR);
  const [bas, setBas] = useState("");
  const [son, setSon] = useState("");
  const [musaitlik, setMusaitlik] = useState<Musaitlik[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [sekme, setSekme] = useState<"yaklasan" | "gecmis">("yaklasan");

  // Ayarlar (admin)
  const [showAyar, setShowAyar] = useState(false);
  const [takvimler, setTakvimler] = useState<Takvim[]>([]);
  const [kullanicilar, setKullanicilar] = useState<Kullanici[]>([]);
  const [yeniTakvim, setYeniTakvim] = useState({ calendarId: "", teacherName: "", teacherEmail: "" });
  const [yeniKullanici, setYeniKullanici] = useState({ name: "", email: "", password: "" });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.user) router.push("/login");
        else setMe({ name: d.user.name, role: d.user.role });
      });
  }, [router]);

  useEffect(() => {
    let active = true;
    fetch("/api/randevu")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { if (active) setRandevular(Array.isArray(d) ? d : []); });
    return () => { active = false; };
  }, [reloadKey]);

  const ayarYukle = useCallback(async () => {
    const r = await fetch("/api/randevu/ayarlar");
    if (r.ok) {
      const d = await r.json();
      setTakvimler(d.takvimler);
      setKullanicilar(d.kullanicilar);
    }
  }, []);

  async function ogrenciBul() {
    setOgrenci(null);
    const r = await fetch(`/api/randevu/ogrenci?phone=${encodeURIComponent(phone)}`);
    const d = await r.json();
    if (!r.ok) { alert(d.error || "Hata"); return; }
    setOgrenci(d);
    if (d.kisi?.name && !studentName) setStudentName(d.kisi.name);
    if (d.kisi?.email && !email) setEmail(d.kisi.email);
  }

  async function saatleriGetir() {
    setLoadingSlots(true);
    setMusaitlik(null);
    const q = new URLSearchParams({ date, ...(bas ? { bas } : {}), ...(son ? { son } : {}) });
    const r = await fetch(`/api/randevu/musaitlik?${q}`);
    const d = await r.json();
    setLoadingSlots(false);
    if (!r.ok) { alert(d.error || "Hata"); return; }
    setMusaitlik(d);
  }

  async function randevuVer(m: Musaitlik, time: string, force = false) {
    if (!phone || !studentName) { alert("Önce öğrencinin telefonunu ve adını girin"); return; }
    if (!force && !confirm(`${m.teacherName} Hoca — ${trTarih(date)} ${time}\n${studentName} için randevu oluşturulsun mu?\n\nÖğrenciye WhatsApp onayı gidecek.`)) return;
    setSaving(true);
    const r = await fetch("/api/randevu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, studentName, email, note, date, time, calendarRefId: m.calendarRefId, force }),
    });
    const d = await r.json();
    setSaving(false);
    if (r.status === 409 && d.haftalikLimit) {
      if (confirm(`${d.error}\n\nYine de randevu verilsin mi?`)) return randevuVer(m, time, true);
      return;
    }
    if (!r.ok) { alert(d.error || "Hata"); if (r.status === 409) saatleriGetir(); return; }
    setMesaj(`✓ ${studentName} — ${m.teacherName} Hoca, ${trTarih(date)} ${time}. Takvime eklendi, WhatsApp onayı gönderiliyor.`);
    setPhone(""); setStudentName(""); setEmail(""); setNote(""); setOgrenci(null); setMusaitlik(null);
    setReloadKey((k) => k + 1);
  }

  async function durumDegistir(r: Randevu, status: string) {
    const soru = status === "cancelled" ? "Randevu iptal edilsin mi? Takvimden de silinir." : status === "noshow" ? "Öğrenci gelmedi olarak işaretlensin mi?" : null;
    if (soru && !confirm(soru)) return;
    const res = await fetch("/api/randevu", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, status }),
    });
    if (!res.ok) { alert((await res.json()).error || "Hata"); return; }
    setReloadKey((k) => k + 1);
  }

  async function ayarKaydet(body: Record<string, unknown>) {
    const r = await fetch("/api/randevu/ayarlar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) { alert(d.error || "Hata"); return false; }
    await ayarYukle();
    return true;
  }

  async function cikis() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const bugun = bugunTR();
  const liste = randevular.filter((r) => (sekme === "yaklasan" ? r.date >= bugun : r.date < bugun));
  const gruplar = liste.reduce<Record<string, Randevu[]>>((a, r) => { (a[r.date] ||= []).push(r); return a; }, {});
  const gunler = Object.keys(gruplar).sort((a, b) => (sekme === "yaklasan" ? a.localeCompare(b) : b.localeCompare(a)));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-white">🗓️ Gelişim Randevuları</h1>
            <p className="text-sm text-slate-400">15 dk görüşme · 0533 destek hattından WhatsApp onayı ve sabah hatırlatması</p>
          </div>
          <div className="flex items-center gap-2">
            {me?.role === "admin" && (
              <>
                <button onClick={() => { setShowAyar(!showAyar); if (!showAyar) ayarYukle(); }}
                  className="px-4 py-2 bg-purple-600/30 text-purple-300 rounded-lg text-sm hover:bg-purple-600/50">⚙️ Ayarlar</button>
                <a href="/admin" className="px-4 py-2 bg-slate-600/30 text-slate-300 rounded-lg text-sm hover:bg-slate-600/50">← Admin</a>
              </>
            )}
            <button onClick={cikis} className="px-4 py-2 bg-red-600/30 text-red-300 rounded-lg text-sm hover:bg-red-600/50">Çıkış</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {showAyar && me?.role === "admin" && (
          <section className="bg-purple-600/10 border border-purple-500/20 rounded-2xl p-5 space-y-5">
            <div>
              <h2 className="text-white font-semibold mb-1">Hoca takvimleri</h2>
              <p className="text-xs text-slate-400 mb-3">
                Google Takvim → takvimin ⋮ menüsü → Ayarlar ve paylaşım → &quot;Takvimi entegre et&quot; → Takvim kimliği. Hoca e-postasına her randevunun daveti gider.
              </p>
              <div className="space-y-2 mb-3">
                {takvimler.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2 text-sm flex-wrap">
                    <span className="text-white font-medium">{t.teacherName}</span>
                    <span className="text-slate-400 text-xs">{t.teacherEmail || "e-posta yok"}</span>
                    <span className="text-slate-500 text-xs">📅 {t.calendarName || t.calendarId.slice(0, 24) + "…"}</span>
                    <span className="flex-1" />
                    <button onClick={() => ayarKaydet({ action: "takvim-guncelle", id: t.id, isActive: !t.isActive })}
                      className={`text-xs px-2 py-1 rounded-lg ${t.isActive ? "bg-green-600/30 text-green-300" : "bg-white/10 text-slate-400"}`}>
                      {t.isActive ? "Aktif" : "Pasif"}
                    </button>
                  </div>
                ))}
                {takvimler.length === 0 && <p className="text-xs text-slate-500">Henüz takvim eklenmedi.</p>}
              </div>
              <div className="flex gap-2 flex-wrap">
                <input value={yeniTakvim.teacherName} onChange={(e) => setYeniTakvim({ ...yeniTakvim, teacherName: e.target.value })} placeholder="Hoca adı (boşsa takvim adından)" className={input} />
                <input value={yeniTakvim.teacherEmail} onChange={(e) => setYeniTakvim({ ...yeniTakvim, teacherEmail: e.target.value })} placeholder="Hoca e-postası" className={input} />
                <input value={yeniTakvim.calendarId} onChange={(e) => setYeniTakvim({ ...yeniTakvim, calendarId: e.target.value })} placeholder="Takvim kimliği" className={`${input} flex-1 min-w-[260px]`} />
                <button onClick={async () => { if (await ayarKaydet({ action: "takvim", ...yeniTakvim })) setYeniTakvim({ calendarId: "", teacherName: "", teacherEmail: "" }); }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">+ Takvim ekle</button>
              </div>
            </div>

            <div>
              <h2 className="text-white font-semibold mb-1">Destek ekibi kullanıcıları</h2>
              <p className="text-xs text-slate-400 mb-3">Bu kullanıcılar giriş yapınca yalnız bu sayfayı görür.</p>
              <div className="space-y-2 mb-3">
                {kullanicilar.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2 text-sm">
                    <span className="text-white">{u.name}</span>
                    <span className="text-slate-400 text-xs">{u.email}</span>
                    <span className="flex-1" />
                    <button onClick={() => ayarKaydet({ action: "kullanici-durum", id: u.id, isActive: !u.isActive })}
                      className={`text-xs px-2 py-1 rounded-lg ${u.isActive ? "bg-green-600/30 text-green-300" : "bg-white/10 text-slate-400"}`}>
                      {u.isActive ? "Aktif" : "Pasif"}
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                <input value={yeniKullanici.name} onChange={(e) => setYeniKullanici({ ...yeniKullanici, name: e.target.value })} placeholder="Ad" className={input} />
                <input value={yeniKullanici.email} onChange={(e) => setYeniKullanici({ ...yeniKullanici, email: e.target.value })} placeholder="E-posta (giriş)" className={input} />
                <input type="password" value={yeniKullanici.password} onChange={(e) => setYeniKullanici({ ...yeniKullanici, password: e.target.value })} placeholder="Şifre (en az 6)" className={input} />
                <button onClick={async () => { if (await ayarKaydet({ action: "kullanici", ...yeniKullanici })) setYeniKullanici({ name: "", email: "", password: "" }); }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">+ Kullanıcı ekle</button>
              </div>
            </div>
          </section>
        )}

        <section className="bg-teal-600/10 border border-teal-500/20 rounded-2xl p-5 space-y-4">
          <h2 className="text-white font-semibold">Yeni randevu</h2>

          <div className="flex gap-2 flex-wrap items-end">
            <div>
              <p className="text-xs text-slate-400 mb-1">Telefon *</p>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={() => phone.replace(/\D/g, "").length >= 10 && ogrenciBul()}
                placeholder="0532 123 45 67" className={input} />
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Öğrenci adı *</p>
              <input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Ad Soyad" className={input} />
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">E-posta (takvim daveti)</p>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@gmail.com" className={input} />
            </div>
            <div className="flex-1 min-w-[180px]">
              <p className="text-xs text-slate-400 mb-1">Not (hoca görür)</p>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ör. 3 haftadır düzenli çalışıyor" className={`${input} w-full`} />
            </div>
          </div>

          {ogrenci && (
            <div className="text-xs text-slate-300 bg-white/5 rounded-lg p-3 space-y-1">
              <p>{ogrenci.kisi ? `Kommo'da bulundu: ${ogrenci.kisi.name}${ogrenci.kisi.email ? ` · ${ogrenci.kisi.email}` : ""}` : "Kommo'da bu numarayla kişi bulunamadı (randevu verilince açılır)."}</p>
              {ogrenci.gecmis.length > 0 && (
                <p className="text-amber-300">
                  Önceki randevular: {ogrenci.gecmis.map((g) => `${trTarih(g.date)} ${g.time} ${g.calendar.teacherName} (${DURUM[g.status]?.label})`).join(" · ")}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2 flex-wrap items-end">
            <div>
              <p className="text-xs text-slate-400 mb-1">Gün</p>
              <input type="date" min={yarinTR()} value={date} onChange={(e) => { setDate(e.target.value); setMusaitlik(null); }} className={input} />
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Öğrencinin uygun olduğu saat (isteğe bağlı)</p>
              <div className="flex gap-1 items-center">
                <input type="time" value={bas} onChange={(e) => setBas(e.target.value)} className={input} />
                <span className="text-slate-500">–</span>
                <input type="time" value={son} onChange={(e) => setSon(e.target.value)} className={input} />
              </div>
            </div>
            <button onClick={saatleriGetir} disabled={loadingSlots}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
              {loadingSlots ? "Takvimlere bakılıyor..." : "Müsait saatleri göster"}
            </button>
          </div>

          {musaitlik && (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {musaitlik.map((m) => (
                <div key={m.calendarRefId} className="bg-white/5 rounded-xl p-3">
                  <p className="text-white font-medium mb-2">{m.teacherName} <span className="text-xs text-slate-500">({m.slots.length} boş)</span></p>
                  {m.error && <p className="text-xs text-red-400">Takvim okunamadı: {m.error}</p>}
                  {!m.error && m.slots.length === 0 && <p className="text-xs text-slate-500">Bu gün boş saat yok.</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {m.slots.map((s) => (
                      <button key={s} disabled={saving} onClick={() => randevuVer(m, s)}
                        className="px-2.5 py-1 rounded-lg text-xs bg-teal-500/20 text-teal-200 hover:bg-teal-500 hover:text-slate-900 disabled:opacity-50">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {musaitlik.length === 0 && <p className="text-sm text-slate-400">Henüz hoca takvimi eklenmedi (Ayarlar).</p>}
            </div>
          )}
          {mesaj && <p className="text-sm text-green-300">{mesaj}</p>}
        </section>

        <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex gap-2 mb-4">
            {(["yaklasan", "gecmis"] as const).map((s) => (
              <button key={s} onClick={() => setSekme(s)}
                className={`px-3 py-1.5 rounded-lg text-xs ${sekme === s ? "bg-slate-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}>
                {s === "yaklasan" ? "Bugün ve sonrası" : "Son 7 gün"}
              </button>
            ))}
          </div>
          {gunler.length === 0 && <p className="text-sm text-slate-500">Randevu yok.</p>}
          <div className="space-y-4">
            {gunler.map((g) => (
              <div key={g}>
                <p className="text-xs text-slate-400 font-medium mb-1.5">{g === bugun ? "Bugün — " : ""}{trTarih(g)}</p>
                <div className="space-y-1">
                  {gruplar[g].map((r) => (
                    <div key={r.id} className={`flex items-center gap-3 text-sm rounded-lg px-3 py-2 flex-wrap ${r.status === "cancelled" ? "bg-white/[0.02] opacity-50" : "bg-white/5"}`}>
                      <span className="text-white font-bold w-12">{r.time}</span>
                      <span className="text-teal-300 w-20">{r.calendar.teacherName}</span>
                      <span className="text-white">{r.studentName}</span>
                      <span className="text-slate-500 text-xs">+{r.phone}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${DURUM[r.status]?.cls}`}>{DURUM[r.status]?.label}</span>
                      {r.confirmSentAt && <span className="text-xs text-green-400" title="WhatsApp onayı gönderildi">💬 onay</span>}
                      {!r.confirmSentAt && r.confirmError && <span className="text-xs text-red-400" title={r.confirmError}>⚠️ onay gitmedi</span>}
                      {r.reminderSentAt && <span className="text-xs text-green-400" title="Sabah hatırlatması gönderildi">⏰ hatırlatıldı</span>}
                      {!r.reminderSentAt && r.reminderError && <span className="text-xs text-red-400" title={r.reminderError}>⚠️ hatırlatma gitmedi</span>}
                      <span className="flex-1" />
                      {r.meetLink && r.status === "scheduled" && (
                        <a href={r.meetLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">📹 Meet</a>
                      )}
                      {r.status === "scheduled" && (
                        <>
                          {r.date <= bugun && <button onClick={() => durumDegistir(r, "done")} className="text-xs text-green-400/80 hover:text-green-300">Yapıldı</button>}
                          {r.date <= bugun && <button onClick={() => durumDegistir(r, "noshow")} className="text-xs text-orange-400/80 hover:text-orange-300">Gelmedi</button>}
                          {r.date >= bugun && <button onClick={() => durumDegistir(r, "cancelled")} className="text-xs text-red-400/70 hover:text-red-400">İptal</button>}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
