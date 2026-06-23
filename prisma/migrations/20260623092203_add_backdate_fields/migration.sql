-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" REAL NOT NULL,
    "totalPrice" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0,
    "discountReason" TEXT,
    "customerType" TEXT NOT NULL DEFAULT 'new',
    "customerNote" TEXT,
    "personCount" INTEGER NOT NULL DEFAULT 1,
    "duration" TEXT NOT NULL DEFAULT 'yearly',
    "packageType" TEXT NOT NULL DEFAULT 'individual',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "isBackdated" BOOLEAN NOT NULL DEFAULT false,
    "backdatedNote" TEXT,
    "backdateApproved" BOOLEAN NOT NULL DEFAULT false,
    "backdateApprovedBy" TEXT,
    "userId" TEXT NOT NULL,
    "packageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Sale_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Sale" ("createdAt", "customerNote", "customerType", "deletedAt", "discount", "discountReason", "duration", "id", "isDeleted", "packageId", "packageType", "personCount", "quantity", "totalPrice", "unitPrice", "updatedAt", "userId") SELECT "createdAt", "customerNote", "customerType", "deletedAt", "discount", "discountReason", "duration", "id", "isDeleted", "packageId", "packageType", "personCount", "quantity", "totalPrice", "unitPrice", "updatedAt", "userId" FROM "Sale";
DROP TABLE "Sale";
ALTER TABLE "new_Sale" RENAME TO "Sale";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
