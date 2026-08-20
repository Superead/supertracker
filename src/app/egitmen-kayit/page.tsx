"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EgitmenKayitPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [iban, setIban] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/educator-register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, phone: phone || null, iban: iban || null }),
    });
    setLoading(false);
    if (res.ok) {
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2500);
    } else {
      const data = await res.json();
      setError(data.error || "Bir hata oluştu");
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
        <div className="bg-white/5 border border-green-500/30 rounded-2xl p-8 max-w-md text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-xl font-bold text-white mb-2">Kayıt Başarılı!</h1>
          <p className="text-slate-400 text-sm">Giriş sayfasına yönlendiriliyorsunuz...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white">📚 Eğitmen Kayıt</h1>
          <p className="text-slate-400 text-sm mt-1">Superead Birebir Eğitim eğitmen kaydı</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-purple-300 text-sm font-medium mb-1">Ad Soyad *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
              placeholder="Adınız Soyadınız" />
          </div>
          <div>
            <label className="block text-purple-300 text-sm font-medium mb-1">Email *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
              placeholder="ornek@mail.com" />
          </div>
          <div>
            <label className="block text-purple-300 text-sm font-medium mb-1">Şifre *</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
              placeholder="En az 6 karakter" />
          </div>
          <div>
            <label className="block text-purple-300 text-sm font-medium mb-1">Telefon</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
              placeholder="+90 5XX XXX XX XX" />
          </div>
          <div>
            <label className="block text-purple-300 text-sm font-medium mb-1">IBAN</label>
            <input value={iban} onChange={(e) => setIban(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
              placeholder="TR__ ____ ____ ____ ____ ____ __" />
            <p className="text-xs text-slate-500 mt-1">Ders ödemeleriniz için. Sonradan da ekleyebilirsiniz.</p>
          </div>

          {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition disabled:opacity-50">
            {loading ? "Kaydediliyor..." : "Kayıt Ol"}
          </button>

          <p className="text-center text-slate-500 text-sm">
            Zaten hesabınız var mı?{" "}
            <a href="/login" className="text-purple-400 hover:text-purple-300">Giriş Yap</a>
          </p>
        </form>
      </div>
    </div>
  );
}
