-- CreateTable
CREATE TABLE "SatisGunluk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gun" TEXT NOT NULL,
    "kommoUserId" INTEGER NOT NULL,
    "kommoAd" TEXT NOT NULL,
    "leadSayisi" INTEGER NOT NULL DEFAULT 0,
    "yazanMusteri" INTEGER NOT NULL DEFAULT 0,
    "satisciMesaj" INTEGER NOT NULL DEFAULT 0,
    "cevapSureleri" TEXT NOT NULL DEFAULT '[]',
    "ilkCevapSureleri" TEXT NOT NULL DEFAULT '[]',
    "cevapsiz" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SatisDurum" (
    "anahtar" TEXT NOT NULL PRIMARY KEY,
    "veri" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "KaliteRaporu" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hafta" TEXT NOT NULL,
    "kommoUserId" INTEGER NOT NULL,
    "grup" TEXT NOT NULL,
    "veri" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "KoclukNotu" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kommoUserId" INTEGER NOT NULL,
    "grup" TEXT NOT NULL,
    "metin" TEXT NOT NULL,
    "durum" TEXT NOT NULL DEFAULT 'acik',
    "hedefTarih" TEXT,
    "olusturan" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tamamlandi" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "SatisGunluk_gun_kommoUserId_key" ON "SatisGunluk"("gun", "kommoUserId");

-- CreateIndex
CREATE UNIQUE INDEX "KaliteRaporu_hafta_kommoUserId_key" ON "KaliteRaporu"("hafta", "kommoUserId");

-- CreateIndex
CREATE INDEX "KoclukNotu_kommoUserId_durum_idx" ON "KoclukNotu"("kommoUserId", "durum");
