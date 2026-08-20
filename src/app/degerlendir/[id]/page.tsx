"use client";

import { useState, useEffect, use } from "react";

export default function DegerlendirPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [info, setInfo] = useState<{ educatorName: string; studentName: string; alreadyRated: boolean } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [score, setScore] = useState(0);
  const [hoverScore, setHoverScore] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/ratings?id=${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setInfo)
      .catch(() => setNotFound(true));
  }, [id]);

  async function handleSubmit() {
    if (!score) return;
    setLoading(true);
    const res = await fetch("/api/ratings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, score, comment: comment || null }),
    });
    setLoading(false);
    if (res.ok) setSubmitted(true);
  }

  const wrapper = (children: React.ReactNode) => (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );

  if (notFound) {
    return wrapper(
      <div className="bg-white/5 border border-red-500/30 rounded-2xl p-8 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <h1 className="text-xl font-bold text-white">Değerlendirme bulunamadı</h1>
        <p className="text-slate-400 text-sm mt-2">Link geçersiz veya süresi dolmuş olabilir.</p>
      </div>
    );
  }

  if (!info) {
    return wrapper(<div className="text-center text-slate-400">Yükleniyor...</div>);
  }

  if (info.alreadyRated || submitted) {
    return wrapper(
      <div className="bg-white/5 border border-green-500/30 rounded-2xl p-8 text-center">
        <div className="text-5xl mb-4">💜</div>
        <h1 className="text-xl font-bold text-white">Teşekkürler!</h1>
        <p className="text-slate-400 text-sm mt-2">
          {submitted ? "Değerlendirmeniz kaydedildi." : "Bu değerlendirme daha önce yapılmış."}
        </p>
      </div>
    );
  }

  return wrapper(
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold text-white">Eğitmen Değerlendirmesi</h1>
        <p className="text-slate-400 text-sm mt-2">
          <span className="text-white font-medium">{info.studentName}</span> adlı öğrencinin eğitmeni{" "}
          <span className="text-purple-300 font-medium">{info.educatorName}</span> hakkındaki görüşünüz bizim için çok değerli.
        </p>
      </div>

      <div className="flex justify-center gap-2 mb-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => setScore(star)}
            onMouseEnter={() => setHoverScore(star)}
            onMouseLeave={() => setHoverScore(0)}
            className="text-4xl transition-transform hover:scale-125"
          >
            {(hoverScore || score) >= star ? "⭐" : "☆"}
          </button>
        ))}
      </div>
      <p className="text-center text-sm text-slate-400 mb-4 h-5">
        {score === 1 && "Çok kötü"}
        {score === 2 && "Kötü"}
        {score === 3 && "Orta"}
        {score === 4 && "İyi"}
        {score === 5 && "Mükemmel"}
      </p>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="Görüşlerinizi yazabilirsiniz (opsiyonel)"
        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none mb-4"
      />

      <button
        onClick={handleSubmit}
        disabled={!score || loading}
        className="w-full py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition disabled:opacity-40"
      >
        {loading ? "Gönderiliyor..." : "Değerlendirmeyi Gönder"}
      </button>
    </div>
  );
}
