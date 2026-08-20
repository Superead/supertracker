-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Educator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "iban" TEXT,
    "userId" TEXT,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Educator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Educator" ("createdAt", "iban", "id", "isActive", "name", "phone", "updatedAt", "userId") SELECT "createdAt", "iban", "id", "isActive", "name", "phone", "updatedAt", "userId" FROM "Educator";
DROP TABLE "Educator";
ALTER TABLE "new_Educator" RENAME TO "Educator";
CREATE UNIQUE INDEX "Educator_userId_key" ON "Educator"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
