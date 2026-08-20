const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const prisma = new PrismaClient();

// Spreadsheet header name -> exact user name in the database
const NAME_MAP = {
  "İREM": "İrem",
  "MERVE": "Merve",
  "EYLÜL": "Eylül",
  "HATİCE": "Hatice",
  "ECEM": "Ecem",
  "MELİKE": "Melike",
  "MİHRİ": "Mihriban",
  "ESRA": "Esra",
  "ALEYNA": "Aleyna",
  "AYBÜKE": "Aybüke",
  "ŞEYMA": "Şeyma",
  "İREM2": "İrem K.", // toLocaleUpperCase("tr-TR") turns "irem2" into "İREM2"
};

/**
 * The source spreadsheet was typed by hand over months, so durations arrive in
 * many shapes: "2 saat 43 dakika", "2saat 5 dakika", "3 saat", "41 dakika",
 * plus typos like "dakşka" / "saqt" / "2 saat3 6 dakika".
 * Returns { minutes } | { leave: true } | null when unparseable.
 */
function parseDuration(raw) {
  if (!raw) return null;
  const text = raw.trim();
  if (!text || text === "-" || text === "SKIP") return null;

  const lower = text.toLocaleLowerCase("tr-TR");
  if (lower.includes("izin")) return { leave: true };

  const numbers = (text.match(/\d+/g) || []).map(Number);
  if (numbers.length === 0) return null;

  // Any spelling that starts with "sa" and isn't "saniye" means hours here
  const hasHours = /\bs[ao]?[aq]?[a-zğüşıöç]*\b/i.test(lower) && /sa/i.test(lower);

  if (!hasHours) {
    const m = numbers[0];
    return m > 0 && m < 600 ? { minutes: m } : null;
  }

  const hours = numbers[0];
  let mins = 0;

  if (numbers.length === 2) {
    mins = numbers[1];
  } else if (numbers.length >= 3) {
    // "2 saat3 6 dakika" -> digits of the minute value got split apart
    const joined = Number(String(numbers[1]) + String(numbers[2]));
    mins = joined < 60 ? joined : numbers[1];
  }

  if (hours > 12 || mins > 59) return null;
  const total = hours * 60 + mins;
  return total > 0 ? { minutes: total } : null;
}

async function main() {
  const dataPath = path.join(__dirname, "call-data.txt");
  if (!fs.existsSync(dataPath)) {
    console.log("📞 call-data.txt yok, arama süresi aktarımı atlandı");
    return;
  }

  const existing = await prisma.callDuration.count();
  if (existing > 0) {
    console.log(`📞 Arama süreleri zaten aktarılmış (${existing} kayıt), atlanıyor`);
    return;
  }

  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  const userByName = new Map(users.map((u) => [u.name, u.id]));

  const lines = fs.readFileSync(dataPath, "utf8").split("\n");
  let month = null;
  let headers = [];
  let imported = 0;
  let leaves = 0;
  const unparsed = [];
  const missingPeople = new Set();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("#MONTH")) {
      month = trimmed.split(/\s+/)[1];
      continue;
    }
    if (trimmed.startsWith("#HEADER")) {
      headers = trimmed.replace("#HEADER", "").trim().split("|");
      continue;
    }
    if (!month || headers.length === 0) continue;

    const cells = trimmed.split("|");
    const day = Number(cells[0]);
    if (!day) continue;
    const date = `${month}-${String(day).padStart(2, "0")}`;

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].trim();
      if (!header || header === "-") continue;

      const dbName = NAME_MAP[header.toLocaleUpperCase("tr-TR")];
      if (!dbName) { missingPeople.add(header); continue; }

      const userId = userByName.get(dbName);
      if (!userId) { missingPeople.add(`${header} → ${dbName} (DB'de yok)`); continue; }

      const raw = cells[i + 1];
      const parsed = parseDuration(raw);
      if (!parsed) {
        if (raw && raw.trim() && raw.trim() !== "-" && raw.trim() !== "SKIP") {
          unparsed.push(`${date} ${header}: "${raw.trim()}"`);
        }
        continue;
      }

      await prisma.callDuration.upsert({
        where: { date_userId: { date, userId } },
        update: {},
        create: {
          date,
          userId,
          minutes: parsed.leave ? null : parsed.minutes,
          isOnLeave: !!parsed.leave,
        },
      });

      if (parsed.leave) leaves++; else imported++;
    }
  }

  console.log(`📞 Arama süreleri aktarıldı: ${imported} kayıt, ${leaves} izin günü`);
  if (missingPeople.size > 0) {
    console.log(`   ⚠️  Sistemde bulunamayan kişiler (atlandı): ${[...missingPeople].join(", ")}`);
  }
  if (unparsed.length > 0) {
    console.log(`   ⚠️  Okunamayan ${unparsed.length} hücre: ${unparsed.slice(0, 5).join(" | ")}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
