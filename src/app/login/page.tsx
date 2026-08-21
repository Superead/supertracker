"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  // Bring back the address used last time on this device
  useEffect(() => {
    const saved = localStorage.getItem("lastEmail");
    if (saved) setEmail(saved);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, rememberMe }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      setLoading(false);
      return;
    }

    if (rememberMe) {
      localStorage.setItem("lastEmail", email.trim());
    } else {
      localStorage.removeItem("lastEmail");
    }

    if (data.user.role === "admin") {
      router.push("/admin");
    } else if (data.user.role === "educator" || data.user.isEducator) {
      router.push("/egitim");
    } else {
      router.push("/agent");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">⚡ SuperTracker</h1>
          <p className="text-purple-300">Satış Takip Sistemi</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20">
          <div className="mb-6">
            <label className="block text-purple-200 text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              name="email"
              id="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="email@superead.com"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-purple-200 text-sm font-medium mb-2">Şifre</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-16 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-300 hover:text-white text-xs px-2 py-1"
                tabIndex={-1}
              >
                {showPassword ? "Gizle" : "Göster"}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 mb-6 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded accent-purple-500"
            />
            <span className="text-purple-200 text-sm">Beni hatırla (90 gün giriş isteme)</span>
          </label>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 disabled:opacity-50 shadow-lg"
          >
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>

          <div className="mt-6 text-center">
            <a href="/egitmen-kayit" className="block text-slate-400 hover:text-purple-300 text-sm transition-colors">
              📚 Eğitmen misiniz? Kayıt olun
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
