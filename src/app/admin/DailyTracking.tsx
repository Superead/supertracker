"use client";

import { useState, useEffect, useCallback } from "react";

interface CallEntry {
  userId: string;
  name: string;
  minutes: number | null;
  isOnLeave: boolean;
}

interface DayRow {
  date: string;
  morning: number;
  evening: number;
  allDay: number;
  teamSize: number;
  teamAvg: number;
  isMorningManual: boolean;
  isEveningManual: boolean;
  autoMorning: number;
  autoEvening: number;
  note: string | null;
  calls: CallEntry[];
}

interface AgentSummary {
  userId: string;
  name: string;
  totalMinutes: number;
  dayCount: number;
  avgMinutes: number;
}

interface TrackingData {
  month: string;
  days: DayRow[];
  agents: { id: string; name: string }[];
  perAgent: AgentSummary[];
  summary: { avgEvening: number; avgTeamAvg: number; totalLeads: number };
  kommoError: string | null;
}

const DAY_NAMES = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

function formatDuration(minutes: number | null) {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} dk`;
  if (m === 0) return `${h} sa`;
  return `${h} sa ${m} dk`;
}

function CallInput({ date, entry, onSaved }: { date: string; entry: CallEntry; onSaved: () => void }) {
  const [hours, setHours] = useState(entry.minutes != null ? String(Math.floor(entry.minutes / 60)) : "");
  const [mins, setMins] = useState(entry.minutes != null ? String(entry.minutes % 60) : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHours(entry.minutes != null ? String(Math.floor(entry.minutes / 60)) : "");
    setMins(entry.minutes != null ? String(entry.minutes % 60) : "");
  }, [entry.minutes]);

  async function save(nextLeave?: boolean) {
    const isOnLeave = nextLeave ?? entry.isOnLeave;
    const total = isOnLeave ? null : (Number(hours || 0) * 60 + Number(mins || 0)) || null;
    setSaving(true);
    await fetch("/api/admin/daily-tracking", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, userId: entry.userId, minutes: total, isOnLeave }),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${entry.isOnLeave ? "bg-slate-700/20 border-slate-600/30" : "bg-white/5 border-white/10"}`}>
      <span className="text-sm text-white w-24 truncate" title={entry.name}>{entry.name}</span>
      {entry.isOnLeave ? (
        <span className="flex-1 text-xs text-slate-400 italic">İzinli</span>
      ) : (
        <div className="flex items-center gap-1 flex-1">
          <input
            type="number" min="0" max="12" value={hours}
            onChange={(e) => setHours(e.target.value)}
            onBlur={() => save()}
            placeholder="0"
            className="w-12 px-2 py-1 bg-white/10 border border-white/20 rounded-lg text-white text-sm text-center focus:ring-2 focus:ring-purple-500 focus:outline-none"
          />
          <span className="text-xs text-slate-500">sa</span>
          <input
            type="number" min="0" max="59" value={mins}
            onChange={(e) => setMins(e.target.value)}
            onBlur={() => save()}
            placeholder="0"
            className="w-12 px-2 py-1 bg-white/10 border border-white/20 rounded-lg text-white text-sm text-center focus:ring-2 focus:ring-purple-500 focus:outline-none"
          />
          <span className="text-xs text-slate-500">dk</span>
        </div>
      )}
      <button
        onClick={() => save(!entry.isOnLeave)}
        disabled={saving}
        className={`px-2 py-1 rounded-lg text-xs transition ${entry.isOnLeave ? "bg-yellow-600/40 text-yellow-200" : "bg-white/5 text-slate-500 hover:bg-white/10"}`}
        title="İzinli olarak işaretle"
      >
        {entry.isOnLeave ? "↩︎" : "İzin"}
      </button>
    </div>
  );
}

export default function DailyTracking() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editMorning, setEditMorning] = useState("");
  const [editEvening, setEditEvening] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/daily-tracking?month=${month}`);
    if (res.ok) {
      const d = await res.json();
      setData(d);
      if (d.days.length > 0 && expandedDate === null) setExpandedDate(d.days[0].date);
    }
    setLoading(false);
    // expandedDate intentionally omitted: only auto-expand on first load
  }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  async function saveOverride(date: string) {
    await fetch("/api/admin/daily-tracking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        morningCount: editMorning === "" ? null : editMorning,
        eveningCount: editEvening === "" ? null : editEvening,
      }),
    });
    setEditingDate(null);
    load();
  }

  if (loading && !data) {
    return <div className="text-center text-slate-400 py-12">Kommo verisi yükleniyor...</div>;
  }
  if (!data) return null;

  const monthOptions: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthOptions.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  return (
    <div className="space-y-6">
      {/* Header + month picker */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">📞 Günlük Takip</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Yazan sayıları Kommo&apos;dan otomatik gelir. Arama sürelerini elle girersiniz.
          </p>
        </div>
        <select
          value={month}
          onChange={(e) => { setMonth(e.target.value); setExpandedDate(null); }}
          className="px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
        >
          {monthOptions.map((m) => (
            <option key={m} value={m} className="bg-slate-800">{m}</option>
          ))}
        </select>
      </div>

      {data.kommoError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-300 text-sm">
          Kommo bağlantısı kurulamadı ({data.kommoError}). Sayılar elle girilebilir.
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-sky-600/20 to-sky-600/5 border border-sky-500/30 rounded-2xl p-4">
          <p className="text-xs text-slate-400">Günlük Ortalama Yazan</p>
          <p className="text-3xl font-bold text-white mt-1">{data.summary.avgEvening}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-600/20 to-purple-600/5 border border-purple-500/30 rounded-2xl p-4">
          <p className="text-xs text-slate-400">Kişi Başı Ortalama</p>
          <p className="text-3xl font-bold text-white mt-1">{data.summary.avgTeamAvg}</p>
        </div>
        <div className="bg-gradient-to-br from-green-600/20 to-green-600/5 border border-green-500/30 rounded-2xl p-4">
          <p className="text-xs text-slate-400">Bu Ay Toplam Lead</p>
          <p className="text-3xl font-bold text-white mt-1">{data.summary.totalLeads}</p>
        </div>
      </div>

      {/* Per-agent monthly call totals */}
      {data.perAgent.some((a) => a.dayCount > 0) && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h4 className="font-bold text-white mb-3">Aylık Arama Süreleri</h4>
          <div className="space-y-2">
            {data.perAgent.filter((a) => a.dayCount > 0).map((a) => {
              const max = data.perAgent[0]?.totalMinutes || 1;
              return (
                <div key={a.userId} className="flex items-center gap-3">
                  <span className="text-sm text-white w-28 truncate">{a.name}</span>
                  <div className="flex-1 bg-white/5 rounded-full h-6 overflow-hidden">
                    <div
                      className="h-6 bg-gradient-to-r from-purple-600 to-purple-400 rounded-full flex items-center justify-end pr-2"
                      style={{ width: `${Math.max((a.totalMinutes / max) * 100, 12)}%` }}
                    >
                      <span className="text-[11px] text-white font-medium">{formatDuration(a.totalMinutes)}</span>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 w-32 text-right">
                    {a.dayCount} gün • ort {formatDuration(a.avgMinutes)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Daily rows */}
      <div className="space-y-2">
        {data.days.map((day) => {
          const dateObj = new Date(`${day.date}T12:00:00`);
          const isExpanded = expandedDate === day.date;
          const filledCalls = day.calls.filter((c) => c.minutes != null || c.isOnLeave).length;

          return (
            <div key={day.date} className={`bg-white/5 border rounded-2xl overflow-hidden transition ${isExpanded ? "border-purple-500/50" : "border-white/10"}`}>
              <button
                onClick={() => setExpandedDate(isExpanded ? null : day.date)}
                className="w-full px-4 py-3 flex items-center gap-4 text-left hover:bg-white/5"
              >
                <div className="w-24">
                  <p className="text-white font-medium">{dateObj.getDate()} {dateObj.toLocaleDateString("tr-TR", { month: "long" })}</p>
                  <p className="text-xs text-slate-500">{DAY_NAMES[dateObj.getDay()]}</p>
                </div>

                <div className="flex items-center gap-5 flex-1">
                  <div>
                    <p className="text-[11px] text-slate-500">09:30</p>
                    <p className="text-white font-medium">
                      {day.morning}
                      {day.isMorningManual && <span className="text-[10px] text-amber-400 ml-1">elle</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">18:30</p>
                    <p className="text-sky-300 font-bold text-lg">
                      {day.evening}
                      {day.isEveningManual && <span className="text-[10px] text-amber-400 ml-1">elle</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">Kişi Başı</p>
                    <p className="text-purple-300 font-medium">{day.teamAvg}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">Gün Sonu</p>
                    <p className="text-slate-400">{day.allDay}</p>
                  </div>
                </div>

                <span className={`text-xs px-2 py-1 rounded-full ${filledCalls === day.calls.length && day.calls.length > 0 ? "bg-green-500/20 text-green-300" : "bg-slate-600/30 text-slate-400"}`}>
                  ⏱ {filledCalls}/{day.calls.length}
                </span>
                <span className="text-slate-400">{isExpanded ? "▲" : "▼"}</span>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-white/10 pt-4 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-slate-300 font-medium">Arama Süreleri</p>
                      <p className="text-xs text-slate-500">Yazınca otomatik kaydedilir</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {day.calls.map((c) => (
                        <CallInput key={c.userId} date={day.date} entry={c} onSaved={load} />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2 border-t border-white/5">
                    {editingDate === day.date ? (
                      <>
                        <span className="text-xs text-slate-400">Elle düzelt:</span>
                        <input
                          type="number" value={editMorning} onChange={(e) => setEditMorning(e.target.value)}
                          placeholder={`09:30 (${day.autoMorning})`}
                          className="w-32 px-2 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                        <input
                          type="number" value={editEvening} onChange={(e) => setEditEvening(e.target.value)}
                          placeholder={`18:30 (${day.autoEvening})`}
                          className="w-32 px-2 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                        <button onClick={() => saveOverride(day.date)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700">Kaydet</button>
                        <button onClick={() => setEditingDate(null)} className="px-3 py-1.5 bg-white/10 text-slate-400 rounded-lg text-xs">İptal</button>
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-slate-500">
                          Kommo: 09:30 → {day.autoMorning} • 18:30 → {day.autoEvening}
                        </span>
                        <button
                          onClick={() => {
                            setEditingDate(day.date);
                            setEditMorning(day.isMorningManual ? String(day.morning) : "");
                            setEditEvening(day.isEveningManual ? String(day.evening) : "");
                          }}
                          className="px-3 py-1.5 bg-white/5 text-slate-400 rounded-lg text-xs hover:bg-white/10 ml-auto"
                        >
                          ✏️ Sayıyı elle düzelt
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
