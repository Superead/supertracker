-- Satış karnesi: bireysel / eğitici ayrımı ve hiç yazılmamış lead sayısı
ALTER TABLE "SatisGunluk" ADD COLUMN "bireyselLead" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SatisGunluk" ADD COLUMN "egiticiLead" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SatisGunluk" ADD COLUMN "bireyselIlkCevap" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "SatisGunluk" ADD COLUMN "egiticiIlkCevap" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "SatisGunluk" ADD COLUMN "dokunulmamis" INTEGER NOT NULL DEFAULT 0;
