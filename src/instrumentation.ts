/*
 * Sunucu açılırken bir kez çalışır. 5 dakikada bir:
 *  - AI devir kontrolü (kapatmak için Railway'de AI_DEVIR_AKTIF=0),
 *  - birebir ders hatırlatmaları (kapatmak için DERS_HATIRLATMA_AKTIF=0; DERS_HATIRLATMA_BOT_ID yoksa göndermez).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.KOMMO_TOKEN) return;

  const gorevler: { ad: string; calistir: () => Promise<unknown> }[] = [];
  if (process.env.AI_DEVIR_AKTIF !== "0") {
    const { aiDevirleriniIsle } = await import("./lib/ai-devir");
    gorevler.push({ ad: "ai-devir", calistir: aiDevirleriniIsle });
  }
  if (process.env.DERS_HATIRLATMA_AKTIF !== "0") {
    const { dersHatirlatmalariniGonder } = await import("./lib/ders-hatirlatma");
    gorevler.push({ ad: "ders-hatirlatma", calistir: () => dersHatirlatmalariniGonder() });
  }
  if (!gorevler.length) return;

  let calisiyor = false;
  const calistir = async () => {
    if (calisiyor) return;
    calisiyor = true;
    for (const g of gorevler) {
      try {
        const o = (await g.calistir()) as { islenen?: unknown[]; gonderilen?: unknown[]; hatalar?: unknown[] };
        if (o?.islenen?.length || o?.gonderilen?.length || o?.hatalar?.length) console.log(`[${g.ad}]`, JSON.stringify(o));
      } catch (e) {
        console.error(`[${g.ad}] hata:`, e instanceof Error ? e.message : e);
      }
    }
    calisiyor = false;
  };
  setTimeout(calistir, 60_000);
  setInterval(calistir, 5 * 60_000);
}
