const { PrismaClient } = require(".prisma/client");
const { hashSync } = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log("Database already seeded, skipping.");
    return;
  }

  console.log("Empty database detected, seeding...");

  await prisma.user.create({
    data: {
      email: "admin@superead.com",
      name: "Admin",
      password: hashSync("admin123", 10),
      role: "admin",
    },
  });

  const teams = await Promise.all([
    prisma.team.create({ data: { name: "İrem-Merve", color: "#e17055" } }),
    prisma.team.create({ data: { name: "Eylül-Hatice", color: "#6c5ce7" } }),
    prisma.team.create({ data: { name: "Ecem-Melike", color: "#00b894" } }),
    prisma.team.create({ data: { name: "Mihri-Esra", color: "#0984e3" } }),
    prisma.team.create({ data: { name: "Aleyna-Aybüke", color: "#fdcb6e" } }),
    prisma.team.create({ data: { name: "Şeyma-İrem", color: "#e84393" } }),
  ]);

  const agents = [
    { name: "İrem", email: "irem@superead.com", teamIdx: 0 },
    { name: "Merve", email: "merve@superead.com", teamIdx: 0 },
    { name: "Eylül", email: "eylul@superead.com", teamIdx: 1 },
    { name: "Hatice", email: "hatice@superead.com", teamIdx: 1 },
    { name: "Ecem", email: "ecem@superead.com", teamIdx: 2 },
    { name: "Melike", email: "melike@superead.com", teamIdx: 2 },
    { name: "Mihriban", email: "mihriban@superead.com", teamIdx: 3 },
    { name: "Esra", email: "esra@superead.com", teamIdx: 3 },
    { name: "Aleyna", email: "aleyna@superead.com", teamIdx: 4 },
    { name: "Aybüke", email: "aybuke@superead.com", teamIdx: 4 },
    { name: "Şeyma", email: "seyma@superead.com", teamIdx: 5 },
    { name: "İrem K.", email: "iremk@superead.com", teamIdx: 5 },
  ];

  for (const a of agents) {
    await prisma.user.create({
      data: {
        email: a.email,
        name: a.name,
        password: hashSync("satis123", 10),
        role: "agent",
        teamId: teams[a.teamIdx].id,
      },
    });
  }

  const egitici = await prisma.product.create({
    data: { name: "Eğitici Eğitimi", description: "Eğitici yetiştirme programı" },
  });

  const superead = await prisma.product.create({
    data: { name: "Superead Yazılım Eğitimi", description: "Hızlı okuma yazılım eğitimi" },
  });

  const egiticiYenileme = await prisma.product.create({
    data: { name: "Eğitici Eğitimi - Kayıt Yenileme (Yeni)", description: "Eğitici eğitimi yeni kayıt yenileme ve 3 aylık paketler" },
  });

  const superYenileme = await prisma.product.create({
    data: { name: "Superead - Kayıt Yenileme (Eski)", description: "Superead yazılım eski kayıt yenileme ve 3 aylık paketler" },
  });

  const egiticiPackages = [
    { name: "1 Kişi - Yıllık (Yeni Fiyat)", personCount: 1, duration: "yearly", basePrice: 4999,
      paymentLinkPayTR: "https://www.paytr.com/link/JFx0c5Z",
      paymentLinkSuperead: "https://pay.superead.com/link/LJgSiGAe" },
    { name: "2 Kişi - Yıllık (Yeni Fiyat)", personCount: 2, duration: "yearly", basePrice: 5499,
      paymentLinkPayTR: "https://www.paytr.com/link/uOyJOai",
      paymentLinkSuperead: "https://pay.superead.com/link/mtPclJQh" },
    { name: "3 Kişi - Yıllık (Yeni Fiyat)", personCount: 3, duration: "yearly", basePrice: 5999,
      paymentLinkPayTR: "https://www.paytr.com/link/slL3Vnc",
      paymentLinkSuperead: "https://pay.superead.com/link/KaOIX8Wd" },
    { name: "4 Kişi - Yıllık (Yeni Fiyat)", personCount: 4, duration: "yearly", basePrice: 6499,
      paymentLinkPayTR: "https://www.paytr.com/link/2Euvn4y",
      paymentLinkSuperead: "https://pay.superead.com/link/K8eMQHpV" },
    { name: "1 Kişi - Yıllık (Kampanya)", personCount: 1, duration: "yearly", basePrice: 3749,
      paymentLinkPayTR: "https://www.paytr.com/link/Apsjy6W",
      paymentLinkSuperead: "https://pay.superead.com/link/TASlOhUv" },
    { name: "2 Kişi - Yıllık (Kampanya)", personCount: 2, duration: "yearly", basePrice: 4249,
      paymentLinkPayTR: "https://www.paytr.com/link/B3HqGs4",
      paymentLinkSuperead: "https://pay.superead.com/link/sWb7Wlz3" },
    { name: "3 Kişi - Yıllık (Kampanya)", personCount: 3, duration: "yearly", basePrice: 4749,
      paymentLinkPayTR: "https://www.paytr.com/link/ku10UVL",
      paymentLinkSuperead: "https://pay.superead.com/link/aLWn2fW5" },
    { name: "4 Kişi - Yıllık (Kampanya)", personCount: 4, duration: "yearly", basePrice: 5249,
      paymentLinkPayTR: "https://www.paytr.com/link/y1leNsC",
      paymentLinkSuperead: "https://pay.superead.com/link/sWb7Wlz3" },
    { name: "1 Kişi - Ömür Boyu (Yeni Fiyat)", personCount: 1, duration: "lifetime", basePrice: 7000,
      paymentLinkPayTR: "https://www.paytr.com/link/yhSfhY6",
      paymentLinkSuperead: "https://pay.superead.com/link/t0rGAb4f" },
    { name: "2 Kişi - Ömür Boyu (Yeni Fiyat)", personCount: 2, duration: "lifetime", basePrice: 9000,
      paymentLinkPayTR: "https://www.paytr.com/link/0Mya3AA",
      paymentLinkSuperead: "https://pay.superead.com/link/A85kOXYf" },
    { name: "3 Kişi - Ömür Boyu (Yeni Fiyat)", personCount: 3, duration: "lifetime", basePrice: 11000,
      paymentLinkPayTR: "https://www.paytr.com/link/NPbKbnT",
      paymentLinkSuperead: "https://pay.superead.com/link/CWQGChUu" },
    { name: "4 Kişi - Ömür Boyu (Yeni Fiyat)", personCount: 4, duration: "lifetime", basePrice: 13000,
      paymentLinkPayTR: "https://www.paytr.com/link/SymOP2E",
      paymentLinkSuperead: "https://pay.superead.com/link/QOGkaEsI" },
    { name: "1 Kişi - Ömür Boyu (Kampanya)", personCount: 1, duration: "lifetime", basePrice: 6000,
      paymentLinkPayTR: "https://www.paytr.com/link/63Z3dTp",
      paymentLinkSuperead: "https://pay.superead.com/link/geCkjTJ4" },
    { name: "2 Kişi - Ömür Boyu (Kampanya)", personCount: 2, duration: "lifetime", basePrice: 8000,
      paymentLinkPayTR: "https://www.paytr.com/link/3JAMVq6",
      paymentLinkSuperead: "https://pay.superead.com/link/BhcOeeWo" },
    { name: "3 Kişi - Ömür Boyu (Kampanya)", personCount: 3, duration: "lifetime", basePrice: 10000,
      paymentLinkPayTR: "https://www.paytr.com/link/kjHKj8r",
      paymentLinkSuperead: "https://pay.superead.com/link/PQB6xpRH" },
    { name: "4 Kişi - Ömür Boyu (Kampanya)", personCount: 4, duration: "lifetime", basePrice: 12000,
      paymentLinkPayTR: "https://www.paytr.com/link/D99Ubas",
      paymentLinkSuperead: "https://pay.superead.com/link/ydpxKB4H" },
    { name: "Birebir 10 Saat - 18.000 TL", personCount: 1, duration: "custom", basePrice: 18000,
      paymentLinkPayTR: "https://www.paytr.com/link/Vn8XQQP", paymentLinkSuperead: null },
    { name: "Birebir 10 Saat - 15.000 TL", personCount: 1, duration: "custom", basePrice: 15000,
      paymentLinkPayTR: "https://www.paytr.com/link/winUK4p", paymentLinkSuperead: null },
    { name: "Özel Tutar - 17.000 TL", personCount: 1, duration: "custom", basePrice: 17000,
      paymentLinkPayTR: "https://www.paytr.com/link/fNQJYDn", paymentLinkSuperead: null },
    { name: "Özel Tutar - 15.000 TL", personCount: 1, duration: "custom", basePrice: 15000,
      paymentLinkPayTR: "https://www.paytr.com/link/6tRJRwO", paymentLinkSuperead: null },
    { name: "Özel Tutar - 14.000 TL", personCount: 1, duration: "custom", basePrice: 14000,
      paymentLinkPayTR: "https://www.paytr.com/link/gVCsx10", paymentLinkSuperead: null },
    { name: "Özel Tutar - 13.000 TL", personCount: 1, duration: "custom", basePrice: 13000,
      paymentLinkPayTR: "https://www.paytr.com/link/uD608bs", paymentLinkSuperead: null },
    { name: "Özel Tutar - 12.000 TL", personCount: 1, duration: "custom", basePrice: 12000,
      paymentLinkPayTR: "https://www.paytr.com/link/hyWNeCc", paymentLinkSuperead: null },
    { name: "Özel Tutar - 11.000 TL", personCount: 1, duration: "custom", basePrice: 11000,
      paymentLinkPayTR: "https://www.paytr.com/link/2oqqAbZ", paymentLinkSuperead: null },
    { name: "Özel Tutar - 10.000 TL", personCount: 1, duration: "custom", basePrice: 10000,
      paymentLinkPayTR: "https://www.paytr.com/link/ER1ihKl", paymentLinkSuperead: null },
  ];

  for (const p of egiticiPackages) {
    await prisma.package.create({ data: { ...p, productId: egitici.id } });
  }

  const superPackages = [
    { name: "1 Kişi - Yıllık", personCount: 1, duration: "yearly", basePrice: 2999,
      paymentLinkPayTR: "https://www.paytr.com/link/utEIfXG",
      paymentLinkSuperead: "https://pay.superead.com/link/uGPJA1MJ" },
    { name: "2 Kişi - Yıllık", personCount: 2, duration: "yearly", basePrice: 3499,
      paymentLinkPayTR: "https://www.paytr.com/link/39khmHH",
      paymentLinkSuperead: "https://pay.superead.com/link/kso4B0vh" },
    { name: "3 Kişi - Yıllık", personCount: 3, duration: "yearly", basePrice: 4249,
      paymentLinkPayTR: "https://www.paytr.com/link/jYfM1qe",
      paymentLinkSuperead: "https://pay.superead.com/link/CTxQ1mOP" },
    { name: "4 Kişi - Yıllık", personCount: 4, duration: "yearly", basePrice: 4999,
      paymentLinkPayTR: "https://www.paytr.com/link/y1leNsC",
      paymentLinkSuperead: "https://pay.superead.com/link/c14LG0hP" },
    { name: "5 Kişi - Yıllık", personCount: 5, duration: "yearly", basePrice: 5249,
      paymentLinkPayTR: "https://www.paytr.com/link/d71WhiE", paymentLinkSuperead: null },
    { name: "1 Kişi - Ömür Boyu", personCount: 1, duration: "lifetime", basePrice: 4000,
      paymentLinkPayTR: "https://www.paytr.com/link/KodnWms", paymentLinkSuperead: null },
    { name: "2 Kişi - Ömür Boyu", personCount: 2, duration: "lifetime", basePrice: 6000,
      paymentLinkPayTR: "https://www.paytr.com/link/idYjFLi", paymentLinkSuperead: null },
    { name: "3 Kişi - Ömür Boyu", personCount: 3, duration: "lifetime", basePrice: 8000,
      paymentLinkPayTR: "https://www.paytr.com/link/eFf9Eld", paymentLinkSuperead: null },
    { name: "4 Kişi - Ömür Boyu", personCount: 4, duration: "lifetime", basePrice: 10000,
      paymentLinkPayTR: "https://www.paytr.com/link/I8srLMi", paymentLinkSuperead: null },
  ];

  for (const p of superPackages) {
    await prisma.package.create({ data: { ...p, productId: superead.id } });
  }

  const egiticiYenilemePackages = [
    { name: "1 Kişi - 3 Aylık (3.499 TL)", personCount: 1, duration: "3month", basePrice: 3499,
      paymentLinkPayTR: "https://www.paytr.com/link/hhphpN0", paymentLinkSuperead: null },
    { name: "2 Kişi - 3 Aylık (3.999 TL)", personCount: 2, duration: "3month", basePrice: 3999,
      paymentLinkPayTR: "https://www.paytr.com/link/SisWFfV", paymentLinkSuperead: null },
    { name: "1 Kişi - Yıllık Yenileme (2.999 TL)", personCount: 1, duration: "yearly", basePrice: 2999,
      paymentLinkPayTR: null, paymentLinkSuperead: "https://pay.superead.com/link/5dBdx5O2" },
    { name: "2 Kişi - Yıllık Yenileme (3.499 TL)", personCount: 2, duration: "yearly", basePrice: 3499,
      paymentLinkPayTR: null, paymentLinkSuperead: "https://pay.superead.com/link/Uli7GCxE" },
    { name: "1 Kişi - Ömür Boyu Yenileme (4.999 TL)", personCount: 1, duration: "lifetime", basePrice: 4999,
      paymentLinkPayTR: null, paymentLinkSuperead: "https://pay.superead.com/link/Sjxum79Q" },
    { name: "2 Kişi - Ömür Boyu Yenileme (5.499 TL)", personCount: 2, duration: "lifetime", basePrice: 5499,
      paymentLinkPayTR: "https://www.paytr.com/link/IjNdFxN", paymentLinkSuperead: null },
  ];

  for (const p of egiticiYenilemePackages) {
    await prisma.package.create({ data: { ...p, productId: egiticiYenileme.id } });
  }

  const superYenilemePackages = [
    { name: "1 Kişi - 3 Aylık (2.499 TL)", personCount: 1, duration: "3month", basePrice: 2499,
      paymentLinkPayTR: "https://www.paytr.com/link/Vp7irLj",
      paymentLinkSuperead: "https://pay.superead.com/link/EIj6rp7Z" },
    { name: "1 Kişi - Kayıt Yenileme (2.249 TL)", personCount: 1, duration: "yearly", basePrice: 2249,
      paymentLinkPayTR: "https://www.paytr.com/link/NspzM4c",
      paymentLinkSuperead: "https://pay.superead.com/link/NF5DoAZe" },
    { name: "2 Kişi - Kayıt Yenileme (2.749 TL)", personCount: 2, duration: "yearly", basePrice: 2749,
      paymentLinkPayTR: null, paymentLinkSuperead: "https://pay.superead.com/link/cNEfWpE7" },
    { name: "1 Kişi - Ömür Boyu Yenileme", personCount: 1, duration: "lifetime", basePrice: 0,
      paymentLinkPayTR: "https://www.paytr.com/link/XMUw7AG", paymentLinkSuperead: null },
    { name: "2 Kişi - 3 Aylık (3.249 TL)", personCount: 2, duration: "3month", basePrice: 3249,
      paymentLinkPayTR: null, paymentLinkSuperead: "https://pay.superead.com/link/nOTLfi94" },
  ];

  for (const p of superYenilemePackages) {
    await prisma.package.create({ data: { ...p, productId: superYenileme.id } });
  }

  const bonusTiers = [
    { minAmount: 25000, bonusAmount: 250 },
    { minAmount: 35000, bonusAmount: 500 },
    { minAmount: 45000, bonusAmount: 1000 },
    { minAmount: 60000, bonusAmount: 1250 },
    { minAmount: 80000, bonusAmount: 1500 },
    { minAmount: 100000, bonusAmount: 2000 },
  ];

  for (const b of bonusTiers) {
    await prisma.bonusTier.create({ data: b });
  }

  console.log("Production seed completed!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
