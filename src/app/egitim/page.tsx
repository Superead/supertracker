"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Educator {
  id: string;
  name: string;
  phone: string | null;
  iban: string | null;
  userId: string | null;
  user?: { id: string; email: string } | null;
  rating?: { avg: number; count: number } | null;
}

interface Student {
  id: string;
  studentName: string;
  parentName: string | null;
  parentPhone: string | null;
  email: string | null;
  grade: string | null;
  totalLessons: number;
  completedLessons: number;
  schedule: string | null;
  notes: string | null;
  status: string;
  followUp21: string | null;
  surveyScore: string | null;
  paymentAmount: string | null;
  isPaid?: boolean;
  educatorId: string | null;
  educator: { id: string; name: string; phone: string | null } | null;
  isListed?: boolean;
  offerPrice?: string | null;
  listingNote?: string | null;
  soldByName?: string | null;
  requests?: { id: string; educatorId: string; educator: { id: string; name: string } }[];
  createdAt: string;
}

interface Listing {
  id: string;
  studentName: string;
  grade: string | null;
  schedule: string | null;
  offerPrice: string | null;
  listingNote: string | null;
  totalLessons: number;
  requestCount: number;
  myRequest: boolean;
}

interface LessonLog {
  id: string;
  lessonNumber: number;
  date: string;
  time: string | null;
  notes: string | null;
  meetLink: string | null;
  educator: { name: string } | null;
  createdAt: string;
}

function ReadingPanel({ studentId }: { studentId: string }) {
  const [rows, setRows] = useState<{ wpm: string; correct: string }[]>(
    Array.from({ length: 4 }, () => ({ wpm: "", correct: "" }))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/education/reading?studentId=${studentId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { textNumber: number; wpm: number | null; correct: number | null }[]) => {
        const newRows = Array.from({ length: 4 }, () => ({ wpm: "", correct: "" }));
        for (const d of data) {
          if (d.textNumber >= 1 && d.textNumber <= 4) {
            newRows[d.textNumber - 1] = {
              wpm: d.wpm !== null ? String(d.wpm) : "",
              correct: d.correct !== null ? String(d.correct) : "",
            };
          }
        }
        setRows(newRows);
      });
  }, [studentId]);

  function updateRow(i: number, field: "wpm" | "correct", value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  async function save() {
    setSaving(true);
    await fetch("/api/education/reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        results: rows.map((r, i) => ({ textNumber: i + 1, wpm: r.wpm || null, correct: r.correct || null })),
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const wpmFilled = rows.filter((r) => r.wpm !== "");
  const correctFilled = rows.filter((r) => r.correct !== "");
  const avgWpm = wpmFilled.length ? Math.round(wpmFilled.reduce((s, r) => s + Number(r.wpm), 0) / wpmFilled.length) : null;
  const avgCorrect = correctFilled.length
    ? Math.round((correctFilled.reduce((s, r) => s + Number(r.correct), 0) / correctFilled.length) * 10) / 10
    : null;

  return (
    <div className="p-3 bg-sky-600/10 border border-sky-500/20 rounded-xl mb-4">
      <p className="text-sm text-sky-300 font-medium mb-3">📖 Okuma Metinleri</p>
      <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-2 items-center max-w-md">
        <span></span>
        <span className="text-xs text-slate-500">Kelime / Dakika</span>
        <span className="text-xs text-slate-500">Doğru Sayısı</span>
        {rows.map((row, i) => (
          <div key={i} className="contents">
            <span className="text-xs text-slate-400 whitespace-nowrap">Metin {i + 1}</span>
            <input type="number" value={row.wpm} onChange={(e) => updateRow(i, "wpm", e.target.value)} placeholder="—"
              className="px-2 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none w-full" />
            <input type="number" value={row.correct} onChange={(e) => updateRow(i, "correct", e.target.value)} placeholder="—"
              className="px-2 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none w-full" />
          </div>
        ))}
        <span className="text-xs text-sky-300 font-bold whitespace-nowrap">Ortalama</span>
        <span className="px-2 py-1.5 text-sky-300 text-xs font-bold">{avgWpm !== null ? `${avgWpm} k/dk` : "—"}</span>
        <span className="px-2 py-1.5 text-sky-300 text-xs font-bold">{avgCorrect !== null ? avgCorrect : "—"}</span>
      </div>
      <button onClick={save} disabled={saving}
        className={`mt-3 px-4 py-1.5 rounded-lg text-xs font-medium transition ${saved ? "bg-green-600/40 text-green-300" : "bg-sky-600 text-white hover:bg-sky-700"} disabled:opacity-50`}>
        {saving ? "Kaydediliyor..." : saved ? "✓ Kaydedildi" : "Kaydet"}
      </button>
    </div>
  );
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Beklemede", color: "text-slate-400", bg: "bg-slate-500/20" },
  planned: { label: "Planlandı", color: "text-blue-400", bg: "bg-blue-500/20" },
  in_progress: { label: "Devam Ediyor", color: "text-yellow-400", bg: "bg-yellow-500/20" },
  completed: { label: "Tamamlandı", color: "text-green-400", bg: "bg-green-500/20" },
};

export default function EgitimPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [educators, setEducators] = useState<Educator[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isExternal, setIsExternal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterEducator, setFilterEducator] = useState("");
  const [filterPayment, setFilterPayment] = useState("all");
  const [togglingPaidId, setTogglingPaidId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editStudent, setEditStudent] = useState({
    studentName: "", parentName: "", parentPhone: "", email: "",
    grade: "", totalLessons: "12", schedule: "", notes: "", paymentAmount: "",
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    studentName: "", parentName: "", parentPhone: "", email: "",
    grade: "", totalLessons: "12", schedule: "", notes: "", educatorId: "", paymentAmount: "",
  });

  const [showAddEducator, setShowAddEducator] = useState(false);
  const [newEducatorName, setNewEducatorName] = useState("");
  const [newEducatorPhone, setNewEducatorPhone] = useState("");
  const [newEducatorIban, setNewEducatorIban] = useState("");
  const [newEducatorEmail, setNewEducatorEmail] = useState("");
  const [newEducatorPassword, setNewEducatorPassword] = useState("");
  const [resetPasswordId, setResetPasswordId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showEducatorList, setShowEducatorList] = useState(false);
  const [editingEducatorId, setEditingEducatorId] = useState<string | null>(null);
  const [editEducator, setEditEducator] = useState({ name: "", phone: "", iban: "" });
  const [lessonLogs, setLessonLogs] = useState<Record<string, LessonLog[]>>({});
  const [showLogsFor, setShowLogsFor] = useState<string | null>(null);
  const [lessonDate, setLessonDate] = useState(new Date().toISOString().split("T")[0]);
  const [lessonTime, setLessonTime] = useState("");
  const [lessonNotes, setLessonNotes] = useState("");
  const [pendingSeenAt, setPendingSeenAt] = useState<string | null>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editLogNotes, setEditLogNotes] = useState("");
  const [educatorSearch, setEducatorSearch] = useState("");
  const [copiedRatingFor, setCopiedRatingFor] = useState<string | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [rejectedRequests, setRejectedRequests] = useState<{ studentName: string; createdAt: string }[]>([]);
  const [listingFormFor, setListingFormFor] = useState<string | null>(null);
  const [listingPrice, setListingPrice] = useState("");
  const [listingNote, setListingNote] = useState("");
  const [currentEducatorId, setCurrentEducatorId] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<{ name: string; phone: string | null; iban: string | null } | null>(null);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editProfilePhone, setEditProfilePhone] = useState("");
  const [editProfileIban, setEditProfileIban] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    setPendingSeenAt(localStorage.getItem("pendingSeenAt"));
  }, []);

  function markPendingSeen() {
    const now = new Date().toISOString();
    localStorage.setItem("pendingSeenAt", now);
    setPendingSeenAt(now);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  async function handleDeleteEducator(id: string, name: string) {
    if (!confirm(`${name} silinsin mi?`)) return;
    const res = await fetch("/api/admin/educators", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) loadData();
  }

  async function loadLessonLogs(studentId: string) {
    const res = await fetch(`/api/education/lessons?studentId=${studentId}`);
    if (res.ok) {
      const logs = await res.json();
      setLessonLogs((prev) => ({ ...prev, [studentId]: logs }));
    }
  }

  async function handleAddLesson(studentId: string) {
    if (!lessonDate) return;
    const res = await fetch("/api/education/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, date: lessonDate, time: lessonTime || null, notes: lessonNotes || null }),
    });
    if (res.ok) {
      setLessonNotes("");
      setLessonTime("");
      setLessonDate(new Date().toISOString().split("T")[0]);
      loadLessonLogs(studentId);
      loadData();
    } else {
      const err = await res.json();
      alert(err.error || "Hata");
    }
  }

  async function loadListings() {
    const res = await fetch("/api/education/listings");
    if (res.ok) {
      const data = await res.json();
      setListings(data.listings || []);
      setRejectedRequests(data.rejected || []);
    }
  }

  async function handleListStudent(studentId: string) {
    const res = await fetch("/api/education/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list", studentId, offerPrice: listingPrice || null, listingNote: listingNote || null }),
    });
    if (res.ok) {
      setListingFormFor(null);
      setListingPrice("");
      setListingNote("");
      loadData();
    }
  }

  async function handleUnlistStudent(studentId: string) {
    await fetch("/api/education/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unlist", studentId }),
    });
    loadData();
  }

  async function handleTogglePaid(studentId: string, currentStatus: boolean) {
    setTogglingPaidId(studentId);
    const res = await fetch("/api/education", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, isPaid: !currentStatus }),
    });
    setTogglingPaidId(null);
    if (res.ok) {
      loadData();
    }
  }

  async function handleSaveProfile() {
    setSavingProfile(true);
    const res = await fetch("/api/education/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: editProfilePhone || null,
        iban: editProfileIban || null,
      }),
    });
    setSavingProfile(false);
    if (res.ok) {
      setEditingProfileId(null);
      loadData();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Kaydedilemedi, lütfen tekrar deneyin");
    }
  }

  async function handleRequestStudent(studentId: string) {
    const res = await fetch("/api/education/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request", studentId }),
    });
    if (res.ok) {
      loadListings();
    } else {
      const err = await res.json();
      alert(err.error || "Hata");
      loadListings();
    }
  }

  async function handleAssignFromRequest(studentId: string, educatorId: string) {
    const res = await fetch("/api/education/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "assign", studentId, educatorId }),
    });
    if (res.ok) loadData();
  }

  async function handleRatingLink(studentId: string) {
    const res = await fetch("/api/ratings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    });
    if (res.ok) {
      const rating = await res.json();
      const url = `${window.location.origin}/degerlendir/${rating.id}`;
      await navigator.clipboard.writeText(url);
      setCopiedRatingFor(studentId);
      setTimeout(() => setCopiedRatingFor(null), 2500);
    } else {
      const err = await res.json();
      alert(err.error || "Hata");
    }
  }

  async function handleSaveLogNotes(logId: string, studentId: string) {
    const res = await fetch("/api/education/lessons", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logId, notes: editLogNotes }),
    });
    if (res.ok) {
      setEditingLogId(null);
      setEditLogNotes("");
      loadLessonLogs(studentId);
    }
  }

  async function handleDeleteLesson(logId: string, studentId: string) {
    if (!confirm("Bu ders kaydı silinsin mi?")) return;
    const res = await fetch("/api/education/lessons", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logId, studentId }),
    });
    if (res.ok) {
      loadLessonLogs(studentId);
      loadData();
    }
  }

  function toggleLogs(studentId: string) {
    if (showLogsFor === studentId) {
      setShowLogsFor(null);
    } else {
      setShowLogsFor(studentId);
      if (!lessonLogs[studentId]) loadLessonLogs(studentId);
    }
  }

  function startEditStudent(s: Student) {
    setEditingStudentId(s.id);
    setEditStudent({
      studentName: s.studentName, parentName: s.parentName || "", parentPhone: s.parentPhone || "",
      email: s.email || "", grade: s.grade || "", totalLessons: String(s.totalLessons),
      schedule: s.schedule || "", notes: s.notes || "", paymentAmount: s.paymentAmount || "",
    });
  }

  async function handleSaveStudent() {
    if (!editingStudentId) return;
    await fetch("/api/admin/students", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingStudentId,
        studentName: editStudent.studentName,
        parentName: editStudent.parentName || null,
        parentPhone: editStudent.parentPhone || null,
        email: editStudent.email || null,
        grade: editStudent.grade || null,
        totalLessons: parseInt(editStudent.totalLessons) || 12,
        schedule: editStudent.schedule || null,
        notes: editStudent.notes || null,
        paymentAmount: editStudent.paymentAmount || null,
      }),
    });
    setEditingStudentId(null);
    loadData();
  }

  function startEditEducator(ed: Educator) {
    setEditingEducatorId(ed.id);
    setEditEducator({ name: ed.name, phone: ed.phone || "", iban: ed.iban || "" });
  }

  async function handleSaveEducator(id: string) {
    const res = await fetch("/api/admin/educators", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editEducator.name, phone: editEducator.phone || null, iban: editEducator.iban || null }),
    });
    if (res.ok) {
      setEditingEducatorId(null);
      loadData();
    }
  }

  async function handleResetPassword(userId: string) {
    if (!newPassword || newPassword.length < 4) { alert("Şifre en az 4 karakter olmalı"); return; }
    const res = await fetch("/api/admin/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, newPassword }),
    });
    if (res.ok) {
      alert("Şifre sıfırlandı");
      setResetPasswordId(null);
      setNewPassword("");
    }
  }

  const loadData = useCallback(async () => {
    const res = await fetch("/api/education");
    if (res.status === 401) { router.push("/login"); return; }
    if (res.status === 403) { router.push("/login"); return; }
    if (res.ok) {
      const data = await res.json();
      setStudents(data.students);
      setEducators(data.educators);
      setIsAdmin(data.isAdmin);
      const internal = data.isAdmin || data.isInternal;
      setCanManage(internal);
      const external = data.isEducator && !data.isInternal && !data.isAdmin;
      setIsExternal(external);
      setCurrentEducatorId(data.currentEducatorId);
      setMyProfile(data.myProfile || null);
      if (external) {
        const lres = await fetch("/api/education/listings");
        if (lres.ok) {
          const ldata = await lres.json();
          setListings(ldata.listings || []);
          setRejectedRequests(ldata.rejected || []);
        }
      }
    }
    setLoading(false);
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...formData,
        totalLessons: parseInt(formData.totalLessons) || 12,
        educatorId: formData.educatorId || null,
      }),
    });
    if (res.ok) {
      setShowAddForm(false);
      setFormData({ studentName: "", parentName: "", parentPhone: "", email: "", grade: "", totalLessons: "12", schedule: "", notes: "", educatorId: "", paymentAmount: "" });
      loadData();
    }
  }

  async function handleAddEducator(e: React.FormEvent) {
    e.preventDefault();
    if (newEducatorEmail && !newEducatorPassword) { alert("Email girildiyse şifre de gerekli"); return; }
    const res = await fetch("/api/admin/educators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newEducatorName,
        phone: newEducatorPhone || null,
        iban: newEducatorIban || null,
        email: newEducatorEmail || null,
        password: newEducatorPassword || null,
      }),
    });
    if (res.ok) {
      setShowAddEducator(false);
      setNewEducatorName("");
      setNewEducatorPhone("");
      setNewEducatorIban("");
      setNewEducatorEmail("");
      setNewEducatorPassword("");
      loadData();
    } else {
      const err = await res.json();
      alert(err.error || "Hata oluştu");
    }
  }

  async function updateStudent(id: string, data: Record<string, unknown>) {
    await fetch("/api/education", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    });
    loadData();
  }

  const filtered = students.filter((s) => {
    if (filterStatus && s.status !== filterStatus) return false;
    if (filterEducator === "none" && s.educatorId) return false;
    if (filterEducator && filterEducator !== "none" && s.educatorId !== filterEducator) return false;
    if (filterPayment === "paid" && !s.isPaid) return false;
    if (filterPayment === "unpaid" && s.isPaid) return false;
    return true;
  });

  const counts = {
    total: students.length,
    pending: students.filter((s) => s.status === "pending").length,
    planned: students.filter((s) => s.status === "planned").length,
    in_progress: students.filter((s) => s.status === "in_progress").length,
    completed: students.filter((s) => s.status === "completed").length,
  };

  const newPendingCount = students.filter(
    (s) => s.status === "pending" && (!pendingSeenAt || new Date(s.createdAt) > new Date(pendingSeenAt))
  ).length;

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Yükleniyor...</div>;

  // External educator: simplified view
  if (isExternal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">📚 Derslerim</h1>
              <p className="text-sm text-slate-400">{students.length} öğrenci</p>
            </div>
            <button onClick={handleLogout} className="px-4 py-2 bg-red-600/30 text-red-300 rounded-lg text-sm hover:bg-red-600/50 transition">
              Çıkış
            </button>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          {/* My Profile */}
          {currentEducatorId && myProfile && (() => {
            const myEd = myProfile;
            return editingProfileId === currentEducatorId ? (
              <div className="bg-white/5 border border-purple-500/30 rounded-2xl p-5">
                <h3 className="text-white font-bold mb-4">Profilim</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-purple-300 text-xs mb-1 block">Telefon</label>
                    <input value={editProfilePhone} onChange={(e) => setEditProfilePhone(e.target.value)}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      placeholder="+90 5XX XXX XX XX" />
                  </div>
                  <div>
                    <label className="text-purple-300 text-xs mb-1 block">IBAN</label>
                    <input value={editProfileIban} onChange={(e) => setEditProfileIban(e.target.value)}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      placeholder="TR__ ____ ____ ____ ____ ____ __" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveProfile()} disabled={savingProfile}
                      className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                      {savingProfile ? "Kaydediliyor..." : "Kaydet"}
                    </button>
                    <button onClick={() => setEditingProfileId(null)}
                      className="flex-1 px-3 py-2 bg-slate-600 text-white rounded-lg text-sm hover:bg-slate-700">
                      İptal
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-purple-600/15 to-purple-600/5 border border-purple-500/30 rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-bold">👤 {myEd.name}</h3>
                    {myEd.phone && <p className="text-slate-400 text-xs mt-1">📞 {myEd.phone}</p>}
                    {myEd.iban && <p className="text-slate-400 text-xs mt-0.5">🏦 {myEd.iban.slice(0, 6)}...</p>}
                  </div>
                  <button onClick={() => {
                    setEditingProfileId(currentEducatorId);
                    setEditProfilePhone(myEd.phone || "");
                    setEditProfileIban(myEd.iban || "");
                  }}
                    className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs hover:bg-purple-700">
                    ✏️ Düzenle
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Open Listings */}
          {listings.length > 0 && (
            <div className="bg-gradient-to-br from-amber-600/15 to-amber-600/5 border border-amber-500/30 rounded-2xl p-5">
              <h2 className="text-white font-bold mb-1">📢 Açık Öğrenciler</h2>
              <p className="text-xs text-slate-400 mb-4">Talep ettiğinizde ilandaki ücreti kabul etmiş olursunuz. Seçilirseniz öğrenci listenizde görünür.</p>
              <div className="space-y-3">
                {listings.map((l) => (
                  <div key={l.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-[180px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-medium">{l.studentName}</span>
                        {l.grade && <span className="text-slate-400 text-xs">{l.grade}</span>}
                        <span className="text-slate-500 text-xs">{l.totalLessons} ders</span>
                      </div>
                      {l.schedule && <p className="text-xs text-slate-400 mt-1">📅 {l.schedule}</p>}
                      {l.listingNote && <p className="text-xs text-slate-500 mt-1">{l.listingNote}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      {l.offerPrice && (
                        <span className="text-green-400 font-bold whitespace-nowrap">{l.offerPrice} ₺</span>
                      )}
                      {l.myRequest ? (
                        <span className="px-4 py-2 bg-blue-600/20 text-blue-300 rounded-xl text-sm whitespace-nowrap">⏳ Talep Edildi</span>
                      ) : (
                        <button onClick={() => handleRequestStudent(l.id)}
                          className="px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 transition whitespace-nowrap">
                          ✋ Talep Et
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {rejectedRequests.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              {rejectedRequests.map((r, i) => (
                <p key={i} className="text-xs text-slate-500">
                  {r.studentName} için başka eğitmen seçildi
                </p>
              ))}
            </div>
          )}

          {students.length === 0 ? (
            <div className="text-center text-slate-400 py-12">Henüz atanmış öğrenciniz yok</div>
          ) : students.map((s) => {
            const st = STATUS_MAP[s.status] || STATUS_MAP.pending;
            const progress = s.totalLessons > 0 ? Math.round((s.completedLessons / s.totalLessons) * 100) : 0;
            const logs = lessonLogs[s.id] || [];
            const isOpen = showLogsFor === s.id;

            return (
              <div key={s.id} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <button onClick={() => toggleLogs(s.id)} className="w-full text-left">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-white font-medium text-lg">{s.studentName}</span>
                      {s.grade && <span className="text-slate-500 text-sm ml-2">{s.grade}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full ml-2 ${st.bg} ${st.color}`}>{st.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-white font-bold">{s.completedLessons}/{s.totalLessons}</span>
                      {s.isPaid && (
                        <span className="px-2 py-0.5 rounded-lg text-xs bg-green-600/30 text-green-300">✓ Ödendi</span>
                      )}
                      <span className="text-slate-400">{isOpen ? "▲" : "▼"}</span>
                    </div>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 mt-2">
                    <div className={`h-2 rounded-full transition-all ${progress >= 100 ? "bg-green-400" : progress > 0 ? "bg-yellow-400" : "bg-slate-600"}`}
                      style={{ width: `${Math.min(progress, 100)}%` }} />
                  </div>
                </button>

                {s.schedule && (
                  <p className="text-xs text-slate-400 mt-2">📅 {s.schedule}</p>
                )}

                {isOpen && (
                  <div className="mt-4 space-y-3">
                    <ReadingPanel studentId={s.id} />
                    {/* Add lesson form */}
                    {s.completedLessons < s.totalLessons && (
                      <div className="bg-green-600/10 border border-green-500/20 rounded-xl p-4">
                        <p className="text-sm text-green-300 font-medium mb-3">Ders {s.completedLessons + 1} Ekle</p>
                        <div className="flex gap-3 items-end flex-wrap">
                          <div className="flex-shrink-0">
                            <p className="text-xs text-slate-500 mb-1">Tarih</p>
                            <input type="date" value={lessonDate} onChange={(e) => setLessonDate(e.target.value)}
                              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                          </div>
                          <div className="flex-shrink-0">
                            <p className="text-xs text-slate-500 mb-1">Saat</p>
                            <input type="time" value={lessonTime} onChange={(e) => setLessonTime(e.target.value)}
                              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                          </div>
                          <div className="flex-1 min-w-[150px]">
                            <p className="text-xs text-slate-500 mb-1">Derste neler yapıldı?</p>
                            <input value={lessonNotes} onChange={(e) => setLessonNotes(e.target.value)} placeholder="Ders notu..."
                              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />
                          </div>
                          <button onClick={() => handleAddLesson(s.id)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition flex-shrink-0">
                            + Ders Ekle
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Lesson logs */}
                    {logs.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-500 font-medium">Ders Geçmişi</p>
                        {logs.map((log) => (
                          <div key={log.id} className="flex items-start gap-3 bg-white/5 rounded-lg p-3">
                            <div className="w-8 h-8 rounded-full bg-purple-600/30 text-purple-300 flex items-center justify-center text-sm font-bold flex-shrink-0">
                              {log.lessonNumber}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white">{log.date}{log.time && ` — ${log.time}`}</p>
                              {editingLogId === log.id ? (
                                <div className="flex gap-2 mt-1">
                                  <input value={editLogNotes} onChange={(e) => setEditLogNotes(e.target.value)} placeholder="Ders notu..." autoFocus
                                    className="flex-1 px-2 py-1 bg-white/10 border border-white/20 rounded-lg text-white text-xs focus:ring-2 focus:ring-green-500 focus:outline-none" />
                                  <button onClick={() => handleSaveLogNotes(log.id, s.id)} className="px-2 py-1 bg-green-600 text-white rounded-lg text-xs">Kaydet</button>
                                  <button onClick={() => setEditingLogId(null)} className="px-2 py-1 bg-white/10 text-slate-400 rounded-lg text-xs">İptal</button>
                                </div>
                              ) : (
                                <>
                                  {log.notes && <p className="text-xs text-slate-400 mt-1">{log.notes}</p>}
                                  <button onClick={() => { setEditingLogId(log.id); setEditLogNotes(log.notes || ""); }}
                                    className="text-xs text-blue-400/70 hover:text-blue-300 mt-1">
                                    {log.notes ? "✏️ Notu Düzenle" : "+ Not Ekle"}
                                  </button>
                                </>
                              )}
                              {log.meetLink && (
                                <a href={log.meetLink} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-1 ml-2">
                                  📹 Meet Linki
                                </a>
                              )}
                            </div>
                            <button onClick={() => handleDeleteLesson(log.id, s.id)}
                              className="text-red-400/50 hover:text-red-400 text-xs flex-shrink-0">✕</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {logs.length === 0 && s.completedLessons >= s.totalLessons && (
                      <p className="text-center text-slate-500 text-sm py-2">Tüm dersler tamamlandı</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </main>
      </div>
    );
  }

  // Admin / Internal educator: full view
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">📚 Birebir Eğitim Takip</h1>
            <p className="text-sm text-slate-400">{counts.total} öğrenci</p>
          </div>
          <div className="flex items-center gap-3">
            {canManage && (
              <button onClick={() => setShowEducatorList(!showEducatorList)}
                className={`px-4 py-2 rounded-lg text-sm transition ${showEducatorList ? "bg-purple-600 text-white ring-2 ring-purple-400/50" : "bg-purple-600/30 text-purple-300 hover:bg-purple-600/50"}`}>
                👩‍🏫 Eğitmenler {showEducatorList ? "▲" : "▼"}
              </button>
            )}
            {canManage && (
              <button onClick={() => setShowAddEducator(!showAddEducator)} className="px-4 py-2 bg-blue-600/30 text-blue-300 rounded-lg text-sm hover:bg-blue-600/50 transition">
                + Eğitmen
              </button>
            )}
            {canManage && (
              <button onClick={() => setShowAddForm(!showAddForm)} className="px-4 py-2 bg-green-600/30 text-green-300 rounded-lg text-sm hover:bg-green-600/50 transition">
                + Öğrenci
              </button>
            )}
            {isAdmin && (
              <a href="/admin" className="px-4 py-2 bg-slate-600/30 text-slate-300 rounded-lg text-sm hover:bg-slate-600/50 transition">
                ← Admin
              </a>
            )}
            <button onClick={handleLogout} className="px-4 py-2 bg-red-600/30 text-red-300 rounded-lg text-sm hover:bg-red-600/50 transition">
              Çıkış
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { key: "pending", label: "Beklemede", icon: "⬜", color: "from-slate-600/20 to-slate-600/10", border: "border-slate-500/30" },
            { key: "planned", label: "Planlandı", icon: "🔵", color: "from-blue-600/20 to-blue-600/10", border: "border-blue-500/30" },
            { key: "in_progress", label: "Devam Ediyor", icon: "🟡", color: "from-yellow-600/20 to-yellow-600/10", border: "border-yellow-500/30" },
            { key: "completed", label: "Tamamlandı", icon: "🟢", color: "from-green-600/20 to-green-600/10", border: "border-green-500/30" },
          ].map((c) => (
            <button
              key={c.key}
              onClick={() => {
                setFilterStatus(filterStatus === c.key ? "" : c.key);
                if (c.key === "pending") markPendingSeen();
              }}
              className={`relative bg-gradient-to-br ${c.color} border ${c.border} rounded-2xl p-4 text-left transition ${filterStatus === c.key ? "ring-2 ring-white/30" : ""}`}
            >
              {c.key === "pending" && newPendingCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[24px] h-6 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                  +{newPendingCount}
                </span>
              )}
              <p className="text-xs text-slate-400">{c.icon} {c.label}</p>
              <p className="text-2xl font-bold text-white mt-1">{counts[c.key as keyof typeof counts]}</p>
            </button>
          ))}
        </div>

        {/* Payment Filter */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setFilterPayment("all")}
            className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition ${filterPayment === "all" ? "bg-slate-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}
          >
            Tüm Durum
          </button>
          <button
            onClick={() => setFilterPayment("unpaid")}
            className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition ${filterPayment === "unpaid" ? "bg-red-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}
          >
            💰 Ödenmemiş
          </button>
          <button
            onClick={() => setFilterPayment("paid")}
            className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition ${filterPayment === "paid" ? "bg-green-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}
          >
            ✓ Ödendi
          </button>
        </div>

        {/* Educator Filter */}
        {educators.length > 0 && educators.length <= 15 && (
          <div className="flex gap-2 mb-4 overflow-x-auto">
            <button
              onClick={() => setFilterEducator("")}
              className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition ${!filterEducator ? "bg-purple-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}
            >
              Tümü
            </button>
            {educators.map((e) => (
              <button
                key={e.id}
                onClick={() => setFilterEducator(filterEducator === e.id ? "" : e.id)}
                className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition ${filterEducator === e.id ? "bg-purple-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}
              >
                {e.name}
              </button>
            ))}
            <button
              onClick={() => setFilterEducator("none")}
              className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition ${filterEducator === "none" ? "bg-purple-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}
            >
              Atanmamış
            </button>
          </div>
        )}
        {educators.length > 15 && (
          <div className="flex gap-2 mb-4 items-center">
            <select
              value={filterEducator}
              onChange={(e) => setFilterEducator(e.target.value)}
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none max-w-xs"
            >
              <option value="">Tüm Eğitmenler</option>
              <option value="none">Atanmamış</option>
              {educators.map((e) => (
                <option key={e.id} value={e.id}>{e.name}{e.rating ? ` ⭐${e.rating.avg}` : ""}</option>
              ))}
            </select>
            {filterEducator && (
              <button onClick={() => setFilterEducator("")} className="px-3 py-2 bg-red-600/30 text-red-300 rounded-lg text-xs hover:bg-red-600/50">Temizle</button>
            )}
          </div>
        )}

        {/* Educator Management */}
        {showEducatorList && canManage && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4 gap-4">
              <h3 className="text-lg font-bold text-white">👩‍🏫 Eğitmen Yönetimi <span className="text-sm text-slate-500 font-normal">({educators.length})</span></h3>
              <div className="flex items-center gap-2">
                <input
                  value={educatorSearch}
                  onChange={(e) => setEducatorSearch(e.target.value)}
                  placeholder="🔍 Eğitmen ara..."
                  className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm w-64 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
                <button onClick={() => setShowEducatorList(false)}
                  className="px-3 py-2 bg-white/10 text-slate-300 rounded-lg text-sm hover:bg-white/20 transition whitespace-nowrap">
                  ✕ Kapat
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {educators
                .filter((ed) => !educatorSearch || ed.name.toLowerCase().includes(educatorSearch.toLowerCase()) || (ed.user?.email || "").toLowerCase().includes(educatorSearch.toLowerCase()))
                .slice(0, 50)
                .map((ed) => (
                <div key={ed.id} className="bg-white/5 rounded-xl p-4">
                  {editingEducatorId === ed.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <input value={editEducator.name} onChange={(e) => setEditEducator({ ...editEducator, name: e.target.value })} placeholder="Ad *"
                          className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
                        <input value={editEducator.phone} onChange={(e) => setEditEducator({ ...editEducator, phone: e.target.value })} placeholder="Telefon"
                          className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
                        <input value={editEducator.iban} onChange={(e) => setEditEducator({ ...editEducator, iban: e.target.value })} placeholder="IBAN"
                          className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleSaveEducator(ed.id)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700">Kaydet</button>
                        <button onClick={() => setEditingEducatorId(null)} className="px-3 py-1.5 bg-white/10 text-slate-400 rounded-lg text-xs">İptal</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-white font-medium">{ed.name}</span>
                        {ed.rating && (
                          <span className="text-yellow-400 text-xs ml-2 bg-yellow-500/10 px-2 py-0.5 rounded-full">
                            ⭐ {ed.rating.avg} ({ed.rating.count})
                          </span>
                        )}
                        {ed.user && <span className="text-slate-500 text-xs ml-2">({ed.user.email})</span>}
                        {!ed.userId && <span className="text-yellow-500 text-xs ml-2">(hesap yok)</span>}
                        {ed.phone && <span className="text-slate-500 text-xs ml-3">📞 {ed.phone}</span>}
                        {ed.iban && <span className="text-slate-500 text-xs ml-3">🏦 {ed.iban.slice(0, 6)}...</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {ed.userId && resetPasswordId === ed.userId ? (
                          <div className="flex items-center gap-2">
                            <input
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="Yeni şifre"
                              type="text"
                              className="px-2 py-1 bg-white/10 border border-white/20 rounded-lg text-white text-xs w-32 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                            />
                            <button onClick={() => handleResetPassword(ed.userId!)} className="px-3 py-1 bg-green-600/30 text-green-300 rounded-lg text-xs hover:bg-green-600/50">Kaydet</button>
                            <button onClick={() => { setResetPasswordId(null); setNewPassword(""); }} className="px-3 py-1 bg-white/10 text-slate-400 rounded-lg text-xs">İptal</button>
                          </div>
                        ) : (
                          <>
                            <button onClick={() => startEditEducator(ed)} className="px-3 py-1 bg-blue-600/30 text-blue-300 rounded-lg text-xs hover:bg-blue-600/50">
                              Düzenle
                            </button>
                            {isAdmin && ed.userId && (
                              <button onClick={() => setResetPasswordId(ed.userId)} className="px-3 py-1 bg-yellow-600/30 text-yellow-300 rounded-lg text-xs hover:bg-yellow-600/50">
                                Şifre Sıfırla
                              </button>
                            )}
                            {isAdmin && (
                              <button onClick={() => handleDeleteEducator(ed.id, ed.name)} className="px-3 py-1 bg-red-600/30 text-red-300 rounded-lg text-xs hover:bg-red-600/50">
                                Sil
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Educator Form */}
        {showAddEducator && canManage && (
          <form onSubmit={handleAddEducator} className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
            <h3 className="text-lg font-bold text-white mb-4">Yeni Eğitmen Ekle</h3>
            <div className="grid grid-cols-2 gap-4">
              <input value={newEducatorName} onChange={(e) => setNewEducatorName(e.target.value)} placeholder="Eğitmen Adı *" required
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
              <input value={newEducatorPhone} onChange={(e) => setNewEducatorPhone(e.target.value)} placeholder="Telefon"
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
              <input value={newEducatorEmail} onChange={(e) => setNewEducatorEmail(e.target.value)} placeholder="Email (giriş için)" type="email"
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
              <input value={newEducatorPassword} onChange={(e) => setNewEducatorPassword(e.target.value)} placeholder="Şifre (giriş için)"
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
              <input value={newEducatorIban} onChange={(e) => setNewEducatorIban(e.target.value)} placeholder="IBAN"
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
            </div>
            <p className="text-xs text-slate-500 mt-2">Email ve şifre girilirse eğitmen sisteme giriş yapabilir ve kendi öğrencilerini takip edebilir.</p>
            <div className="flex gap-2 mt-4">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Ekle</button>
              <button type="button" onClick={() => setShowAddEducator(false)} className="px-4 py-2 bg-white/10 text-slate-300 rounded-lg text-sm">İptal</button>
            </div>
          </form>
        )}

        {/* Add Student Form */}
        {showAddForm && canManage && (
          <form onSubmit={handleAddStudent} className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
            <h3 className="text-lg font-bold text-white mb-4">Yeni Öğrenci Ekle</h3>
            <div className="grid grid-cols-2 gap-4">
              <input value={formData.studentName} onChange={(e) => setFormData({ ...formData, studentName: e.target.value })} placeholder="Öğrenci Adı *" required
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
              <input value={formData.parentName} onChange={(e) => setFormData({ ...formData, parentName: e.target.value })} placeholder="Veli Adı"
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
              <input value={formData.parentPhone} onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })} placeholder="Veli Telefon"
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
              <input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="Email"
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
              <input value={formData.grade} onChange={(e) => setFormData({ ...formData, grade: e.target.value })} placeholder="Sınıf"
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
              <select value={formData.totalLessons} onChange={(e) => setFormData({ ...formData, totalLessons: e.target.value })}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none">
                <option value="10">10 Ders</option>
                <option value="12">12 Ders</option>
              </select>
              <select value={formData.educatorId} onChange={(e) => setFormData({ ...formData, educatorId: e.target.value })}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none">
                <option value="">Eğitmen Seçin</option>
                {educators.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
              <input value={formData.paymentAmount} onChange={(e) => setFormData({ ...formData, paymentAmount: e.target.value })} placeholder="Ödeme Miktarı"
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
            </div>
            <input value={formData.schedule} onChange={(e) => setFormData({ ...formData, schedule: e.target.value })} placeholder="Ders Günleri ve Saatleri"
              className="w-full mt-4 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
            <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Notlar" rows={2}
              className="w-full mt-4 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none" />
            <div className="flex gap-2 mt-4">
              <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Ekle</button>
              <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 bg-white/10 text-slate-300 rounded-lg text-sm">İptal</button>
            </div>
          </form>
        )}

        {/* Students List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center text-slate-400 py-12">Öğrenci bulunamadı</div>
          ) : filtered.map((s) => {
            const st = STATUS_MAP[s.status] || STATUS_MAP.pending;
            const progress = s.totalLessons > 0 ? Math.round((s.completedLessons / s.totalLessons) * 100) : 0;
            const isExpanded = expandedId === s.id;

            return (
              <div key={s.id} className={`bg-white/5 border border-white/10 rounded-2xl overflow-hidden transition ${isExpanded ? "ring-1 ring-purple-500/50" : ""}`}>
                {/* Card Header */}
                <button onClick={() => setExpandedId(isExpanded ? null : s.id)} className="w-full px-5 py-4 flex items-center gap-4 text-left">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="text-white font-medium">{s.studentName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}>{st.label}</span>
                      {s.isListed && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                          📢 İlanda{(s.requests || []).length > 0 ? ` • ${(s.requests || []).length} talep` : ""}
                        </span>
                      )}
                      {s.isPaid ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300">✓ Ödendi</span>
                      ) : s.educator ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-300">💰 Ödenmedi</span>
                      ) : null}
                      {s.grade && <span className="text-slate-500 text-xs">{s.grade}</span>}
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      {s.educator && <span className="text-purple-400 text-xs">👩‍🏫 {s.educator.name}</span>}
                      {s.parentName && <span className="text-slate-500 text-xs">👤 {s.parentName}</span>}
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <div>
                      <p className="text-white text-sm font-medium">{s.completedLessons}/{s.totalLessons}</p>
                      <div className="w-24 bg-white/10 rounded-full h-2 mt-1">
                        <div className={`h-2 rounded-full transition-all ${progress >= 100 ? "bg-green-400" : progress > 0 ? "bg-yellow-400" : "bg-slate-600"}`}
                          style={{ width: `${Math.min(progress, 100)}%` }} />
                      </div>
                    </div>
                    <span className="text-slate-400 text-lg">{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-white/10 pt-4">
                    {editingStudentId === s.id ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Öğrenci Adı</p>
                            <input value={editStudent.studentName} onChange={(e) => setEditStudent({ ...editStudent, studentName: e.target.value })}
                              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Veli Adı</p>
                            <input value={editStudent.parentName} onChange={(e) => setEditStudent({ ...editStudent, parentName: e.target.value })}
                              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Veli Telefon</p>
                            <input value={editStudent.parentPhone} onChange={(e) => setEditStudent({ ...editStudent, parentPhone: e.target.value })}
                              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Email</p>
                            <input value={editStudent.email} onChange={(e) => setEditStudent({ ...editStudent, email: e.target.value })}
                              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Sınıf</p>
                            <input value={editStudent.grade} onChange={(e) => setEditStudent({ ...editStudent, grade: e.target.value })}
                              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Toplam Ders</p>
                            <select value={editStudent.totalLessons} onChange={(e) => setEditStudent({ ...editStudent, totalLessons: e.target.value })}
                              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none">
                              <option value="10">10 Ders</option>
                              <option value="12">12 Ders</option>
                            </select>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Ödeme</p>
                            <input value={editStudent.paymentAmount} onChange={(e) => setEditStudent({ ...editStudent, paymentAmount: e.target.value })}
                              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Ders Programı</p>
                          <input value={editStudent.schedule} onChange={(e) => setEditStudent({ ...editStudent, schedule: e.target.value })}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Notlar</p>
                          <textarea value={editStudent.notes} onChange={(e) => setEditStudent({ ...editStudent, notes: e.target.value })} rows={2}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={handleSaveStudent} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Kaydet</button>
                          <button onClick={() => setEditingStudentId(null)} className="px-4 py-2 bg-white/10 text-slate-300 rounded-lg text-sm">İptal</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <div className="grid grid-cols-2 gap-4 flex-1">
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Veli Telefon</p>
                              <p className="text-sm text-white">{s.parentPhone || "—"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Email</p>
                              <p className="text-sm text-white">{s.email || "—"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Ders Programı</p>
                              <p className="text-sm text-white">{s.schedule || "—"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Ödeme</p>
                              <p className="text-sm text-white">{s.paymentAmount || "—"}</p>
                            </div>
                            {s.soldByName && (
                              <div>
                                <p className="text-xs text-slate-500 mb-1">Satışı Giren</p>
                                <p className="text-sm text-white">🛒 {s.soldByName}</p>
                              </div>
                            )}
                          </div>
                          {canManage && (
                            <button onClick={() => startEditStudent(s)} className="ml-4 px-3 py-1.5 bg-blue-600/30 text-blue-300 rounded-lg text-xs hover:bg-blue-600/50 self-start">
                              Düzenle
                            </button>
                          )}
                        </div>

                        {s.notes && (
                          <div className="mb-4">
                            <p className="text-xs text-slate-500 mb-1">Notlar</p>
                            <p className="text-sm text-white bg-white/5 rounded-lg p-3">{s.notes}</p>
                          </div>
                        )}

                        <ReadingPanel studentId={s.id} />

                        {/* Lesson Controls */}
                        <div className="flex items-center gap-3 mb-4 p-3 bg-white/5 rounded-xl">
                          <span className="text-sm text-slate-400">Tamamlanan Ders:</span>
                          <span className="text-white font-bold text-lg min-w-[3rem] text-center">{s.completedLessons}/{s.totalLessons}</span>
                          <div className="flex items-center gap-2 ml-auto">
                            {s.educatorId && (
                              <button onClick={() => handleTogglePaid(s.id, s.isPaid || false)}
                                disabled={togglingPaidId === s.id}
                                className={`px-3 py-1 rounded-lg text-xs transition disabled:opacity-50 ${s.isPaid ? "bg-green-600/40 text-green-300 hover:bg-green-600/60" : "bg-red-600/30 text-red-300 hover:bg-red-600/50"}`}>
                                {s.isPaid ? "✓ Eğitmene Ödendi" : "💰 Ödendi İşaretle"}
                              </button>
                            )}
                            {s.educatorId && (
                              <button onClick={() => handleRatingLink(s.id)}
                                className={`px-3 py-1 rounded-lg text-xs transition ${copiedRatingFor === s.id ? "bg-green-600/40 text-green-300" : "bg-yellow-600/30 text-yellow-300 hover:bg-yellow-600/50"}`}>
                                {copiedRatingFor === s.id ? "✓ Link Kopyalandı" : "⭐ Değerlendirme Linki"}
                              </button>
                            )}
                            <button onClick={() => toggleLogs(s.id)}
                              className="px-3 py-1 bg-purple-600/30 text-purple-300 rounded-lg text-xs hover:bg-purple-600/50">
                              {showLogsFor === s.id ? "Günlüğü Gizle" : "Ders Günlüğü"}
                            </button>
                          </div>
                        </div>

                        {/* Lesson Logs */}
                        {showLogsFor === s.id && (() => {
                          const logs = lessonLogs[s.id] || [];
                          return (
                            <div className="mb-4 space-y-2">
                              {s.completedLessons < s.totalLessons && (
                                <div className="flex gap-2 items-end p-3 bg-green-600/10 border border-green-500/20 rounded-xl flex-wrap">
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">Tarih</p>
                                    <input type="date" value={lessonDate} onChange={(e) => setLessonDate(e.target.value)}
                                      className="px-2 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white text-xs focus:ring-2 focus:ring-green-500 focus:outline-none" />
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1">Saat</p>
                                    <input type="time" value={lessonTime} onChange={(e) => setLessonTime(e.target.value)}
                                      className="px-2 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white text-xs focus:ring-2 focus:ring-green-500 focus:outline-none" />
                                  </div>
                                  <div className="flex-1 min-w-[120px]">
                                    <p className="text-xs text-slate-500 mb-1">Not</p>
                                    <input value={lessonNotes} onChange={(e) => setLessonNotes(e.target.value)} placeholder="Derste neler yapıldı..."
                                      className="w-full px-2 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white text-xs focus:ring-2 focus:ring-green-500 focus:outline-none" />
                                  </div>
                                  <button onClick={() => handleAddLesson(s.id)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700">+ Ders</button>
                                </div>
                              )}
                              {logs.map((log) => (
                                <div key={log.id} className="flex items-start gap-2 bg-white/5 rounded-lg p-2.5">
                                  <span className="w-6 h-6 rounded-full bg-purple-600/30 text-purple-300 flex items-center justify-center text-xs font-bold flex-shrink-0">{log.lessonNumber}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-white">{log.date}{log.time && ` — ${log.time}`}</span>
                                      {log.educator && <span className="text-xs text-slate-500">— {log.educator.name}</span>}
                                    </div>
                                    {editingLogId === log.id ? (
                                      <div className="flex gap-2 mt-1">
                                        <input value={editLogNotes} onChange={(e) => setEditLogNotes(e.target.value)} placeholder="Ders notu..." autoFocus
                                          className="flex-1 px-2 py-1 bg-white/10 border border-white/20 rounded-lg text-white text-xs focus:ring-2 focus:ring-green-500 focus:outline-none" />
                                        <button onClick={() => handleSaveLogNotes(log.id, s.id)} className="px-2 py-1 bg-green-600 text-white rounded-lg text-xs">Kaydet</button>
                                        <button onClick={() => setEditingLogId(null)} className="px-2 py-1 bg-white/10 text-slate-400 rounded-lg text-xs">İptal</button>
                                      </div>
                                    ) : (
                                      <>
                                        {log.notes && <p className="text-xs text-slate-400 mt-0.5">{log.notes}</p>}
                                        <button onClick={() => { setEditingLogId(log.id); setEditLogNotes(log.notes || ""); }}
                                          className="text-xs text-blue-400/70 hover:text-blue-300 mt-0.5">
                                          {log.notes ? "✏️ Notu Düzenle" : "+ Not Ekle"}
                                        </button>
                                      </>
                                    )}
                                    {log.meetLink && (
                                      <a href={log.meetLink} target="_blank" rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-0.5 ml-2">
                                        📹 Meet Linki
                                      </a>
                                    )}
                                  </div>
                                  <button onClick={() => handleDeleteLesson(log.id, s.id)} className="text-red-400/40 hover:text-red-400 text-xs">✕</button>
                                </div>
                              ))}
                              {logs.length === 0 && <p className="text-xs text-slate-500 text-center py-2">Henüz ders kaydı yok</p>}
                            </div>
                          );
                        })()}

                        {/* Listing Management */}
                        {canManage && !s.educatorId && (
                          <div className="mb-4 p-3 bg-amber-600/10 border border-amber-500/20 rounded-xl">
                            {s.isListed ? (
                              <div>
                                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                                  <span className="text-sm text-amber-300 font-medium">
                                    📢 İlanda {s.offerPrice && <span className="text-green-400">• {s.offerPrice} ₺</span>} • {(s.requests || []).length} talep
                                  </span>
                                  <button onClick={() => handleUnlistStudent(s.id)}
                                    className="px-3 py-1 bg-red-600/30 text-red-300 rounded-lg text-xs hover:bg-red-600/50">İlanı Kapat</button>
                                </div>
                                {(s.requests || []).length > 0 ? (
                                  <div className="space-y-1.5">
                                    {(s.requests || []).map((req) => {
                                      const reqEducator = educators.find((e) => e.id === req.educatorId);
                                      return (
                                        <div key={req.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                                          <div>
                                            <span className="text-sm text-white">{req.educator.name}</span>
                                            {reqEducator?.rating && (
                                              <span className="text-yellow-400 text-xs ml-2">⭐ {reqEducator.rating.avg} ({reqEducator.rating.count})</span>
                                            )}
                                          </div>
                                          <button onClick={() => handleAssignFromRequest(s.id, req.educatorId)}
                                            className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700">Seç</button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-500">Henüz talep yok</p>
                                )}
                              </div>
                            ) : listingFormFor === s.id ? (
                              <div className="flex gap-2 items-end flex-wrap">
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">Ders Başı Ücret (₺)</p>
                                  <input value={listingPrice} onChange={(e) => setListingPrice(e.target.value)} placeholder="Örn: 400" type="number"
                                    className="w-28 px-2 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                                </div>
                                <div className="flex-1 min-w-[150px]">
                                  <p className="text-xs text-slate-500 mb-1">İlan Notu</p>
                                  <input value={listingNote} onChange={(e) => setListingNote(e.target.value)} placeholder="Örn: Hafta içi akşam uygun olan..."
                                    className="w-full px-2 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                                </div>
                                <button onClick={() => handleListStudent(s.id)}
                                  className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs hover:bg-amber-700">Yayınla</button>
                                <button onClick={() => setListingFormFor(null)}
                                  className="px-3 py-1.5 bg-white/10 text-slate-400 rounded-lg text-xs">İptal</button>
                              </div>
                            ) : (
                              <button onClick={() => { setListingFormFor(s.id); setListingPrice(""); setListingNote(""); }}
                                className="px-3 py-1.5 bg-amber-600/30 text-amber-300 rounded-lg text-xs hover:bg-amber-600/50">
                                📢 İlana Aç — eğitmenler görsün ve talep etsin
                              </button>
                            )}
                          </div>
                        )}

                        {/* Status & Actions */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-slate-500">Durum:</span>
                          {(["pending", "planned", "in_progress", "completed"] as const).map((st) => (
                            <button key={st} onClick={() => updateStudent(s.id, { status: st })}
                              className={`px-3 py-1 rounded-lg text-xs transition ${s.status === st
                                ? `${STATUS_MAP[st].bg} ${STATUS_MAP[st].color} ring-1 ring-white/20`
                                : "bg-white/5 text-slate-500 hover:bg-white/10"
                              }`}>
                              {STATUS_MAP[st].label}
                            </button>
                          ))}

                          {canManage && (
                            <select
                              value={s.educatorId || ""}
                              onChange={(e) => updateStudent(s.id, { educatorId: e.target.value || null, status: e.target.value ? (s.status === "pending" ? "planned" : s.status) : s.status })}
                              className="ml-auto px-3 py-1 bg-white/10 border border-white/20 rounded-lg text-white text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                            >
                              <option value="">Eğitmen Seç</option>
                              {educators.map((e) => (
                                <option key={e.id} value={e.id}>{e.name}</option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* 21 Day Follow-up */}
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-xs text-slate-500">21 Günlük Takip:</span>
                          {["", "Başladı-Devam Ediyor", "Tamamlandı"].map((val) => (
                            <button key={val || "none"} onClick={() => updateStudent(s.id, { followUp21: val || null })}
                              className={`px-3 py-1 rounded-lg text-xs transition ${(s.followUp21 || "") === val
                                ? "bg-purple-600/30 text-purple-300 ring-1 ring-white/20"
                                : "bg-white/5 text-slate-500 hover:bg-white/10"
                              }`}>
                              {val || "Yok"}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
