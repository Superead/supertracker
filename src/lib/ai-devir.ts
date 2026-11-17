/*
 * Kommo AI temsilcisi müşteriyi danışmana devrettiğinde danışmanın bunu görmesini sağlar.
 *
 * Kommo AI devrederken lead'e yalnız İngilizce bir "ai_result" özet notu düşüyor.
 * Ayarlardaki "Görev ekle" eylemi çalışmıyor ve AI aşama değiştiremiyor.
 * Bu modül birkaç dakikada bir son AI notlarını tarar ve "AI Geri Kazanım"
 * aşamasındaki her devredilen lead için:
 *   1. sorumlu danışmana Türkçe, hemen tarihli bir takip görevi açar,
 *   2. işaret notu bırakır (aynı devir iki kez işlenmesin diye),
 *   3. ai-devretti etiketini ekler ve lead'i "Düşünüyor / Takipte" aşamasına taşır.
 * Düşünüyor, AI temsilcisinin durma aşamalarından biri; müşteriye artık yalnız danışman yazar.
 */

const KOMMO_TOKEN = process.env.KOMMO_TOKEN;
const KOMMO_SUBDOMAIN = process.env.KOMMO_SUBDOMAIN || "mehmettashanligil";

const PIPELINE_ID = parseInt(process.env.KOMMO_PIPELINE_ID || "12058160");
const AI_ASAMA_ID = parseInt(process.env.AI_GERI_KAZANIM_STATUS_ID || "114221320");
const HEDEF_ASAMA_ID = parseInt(process.env.AI_DEVIR_HEDEF_STATUS_ID || "93042988"); // Düşünüyor / Takipte
const ETIKET = "ai-devretti";
const ISARET = "[AI-DEVİR]";
const TAKIP_GOREV_TIPI = 1; // Kommo'nun yerleşik "Takip" görev türü
const TARAMA_SAAT = 24; // sunucu bir süre kapalı kalırsa kaçan devirleri de yakalar

type Not = { id: number; entity_id: number; created_at: number; note_type: string; params?: { text?: string; is_error?: boolean } };
type Lead = { id: number; status_id: number; pipeline_id: number; responsible_user_id: number };

async function kommo<T>(method: string, path: string, body?: unknown, retried = false): Promise<T | null> {
  if (!KOMMO_TOKEN) throw new Error("KOMMO_TOKEN not configured");
  const res = await fetch(`https://${KOMMO_SUBDOMAIN}.kommo.com/api/v4${path}`, {
    method,
    headers: { Authorization: `Bearer ${KOMMO_TOKEN}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (res.status === 204) return null;
  if (res.status === 429 && !retried) {
    await new Promise((r) => setTimeout(r, 1500));
    return kommo<T>(method, path, body, true);
  }
  if (!res.ok) throw new Error(`Kommo ${method} ${path.split("?")[0]}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

export type DevirOzeti = { taranan: number; islenen: number[]; hatalar: string[] };

export async function aiDevirleriniIsle(): Promise<DevirOzeti> {
  const ozet: DevirOzeti = { taranan: 0, islenen: [], hatalar: [] };
  const from = Math.floor(Date.now() / 1000) - TARAMA_SAAT * 3600;

  const notlar = await kommo<{ _embedded: { notes: Not[] } }>(
    "GET",
    `/leads/notes?filter[note_type]=ai_result&filter[updated_at][from]=${from}&limit=250`,
  );
  // Lead başına en yeni geçerli AI notu.
  const sonAiNotu = new Map<number, Not>();
  for (const n of notlar?._embedded.notes ?? []) {
    if (n.params?.is_error) continue;
    const onceki = sonAiNotu.get(n.entity_id);
    if (!onceki || n.created_at > onceki.created_at) sonAiNotu.set(n.entity_id, n);
  }
  ozet.taranan = sonAiNotu.size;
  if (!sonAiNotu.size) return ozet;

  // Yalnız şu an AI Geri Kazanım aşamasında duranlar; DESTEK AGENT'ın notları burada elenir.
  const idler = [...sonAiNotu.keys()];
  const q = idler.map((id, i) => `filter[id][${i}]=${id}`).join("&");
  const leads = await kommo<{ _embedded: { leads: Lead[] } }>("GET", `/leads?${q}&limit=250`);
  const adaylar = (leads?._embedded.leads ?? []).filter(
    (l) => l.pipeline_id === PIPELINE_ID && l.status_id === AI_ASAMA_ID,
  );

  for (const lead of adaylar) {
    const aiNotu = sonAiNotu.get(lead.id)!;
    try {
      // Bu devir daha önce işlendiyse (işaret notu AI notundan sonra yazılmışsa) atla.
      const ortak = await kommo<{ _embedded: { notes: Not[] } }>(
        "GET",
        `/leads/${lead.id}/notes?filter[note_type]=common&filter[updated_at][from]=${aiNotu.created_at}&limit=50`,
      );
      if ((ortak?._embedded.notes ?? []).some((n) => n.params?.text?.startsWith(ISARET))) continue;

      await kommo("POST", "/tasks", [
        {
          entity_id: lead.id,
          entity_type: "leads",
          responsible_user_id: lead.responsible_user_id,
          task_type_id: TAKIP_GOREV_TIPI,
          complete_till: Math.floor(Date.now() / 1000) + 30 * 60,
          text:
            "AI müşteriyi size devretti: kampanya/fiyat detayı veya danışmanla görüşme istedi. " +
            "WhatsApp sohbetinden yazın ya da arayın, bugünkü kampanyayı iletin. Görüşme özeti lead notlarında.",
        },
      ]);
      await kommo("POST", `/leads/${lead.id}/notes`, [
        {
          note_type: "common",
          params: {
            text:
              `${ISARET} AI temsilcisi müşteriyi danışmana devretti; sorumlu kişiye görev açıldı ve lead ` +
              `"Düşünüyor / Takipte" aşamasına taşındı. AI bu müşteriye artık yazmaz. ` +
              `Kommo'nun İngilizce görüşme özeti bir üstteki AI notunda.`,
          },
        },
      ]);
      await kommo("PATCH", `/leads/${lead.id}`, {
        pipeline_id: PIPELINE_ID,
        status_id: HEDEF_ASAMA_ID,
        tags_to_add: [{ name: ETIKET }],
      });
      ozet.islenen.push(lead.id);
    } catch (e) {
      ozet.hatalar.push(`${lead.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return ozet;
}
