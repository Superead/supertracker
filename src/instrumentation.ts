/*
 * Sunucu açılırken bir kez çalışır. AI devir kontrolünü 5 dakikada bir başlatır.
 * Kapatmak için Railway'de AI_DEVIR_AKTIF=0 yapın.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.AI_DEVIR_AKTIF === "0" || !process.env.KOMMO_TOKEN) return;

  const { aiDevirleriniIsle } = await import("./lib/ai-devir");
  let calisiyor = false;
  const calistir = async () => {
    if (calisiyor) return;
    calisiyor = true;
    try {
      const o = await aiDevirleriniIsle();
      if (o.islenen.length || o.hatalar.length) console.log("[ai-devir]", JSON.stringify(o));
    } catch (e) {
      console.error("[ai-devir] hata:", e instanceof Error ? e.message : e);
    } finally {
      calisiyor = false;
    }
  };
  setTimeout(calistir, 60_000);
  setInterval(calistir, 5 * 60_000);
}
