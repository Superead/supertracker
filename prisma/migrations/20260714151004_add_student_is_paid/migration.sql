-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentName" TEXT NOT NULL,
    "parentName" TEXT,
    "parentPhone" TEXT,
    "email" TEXT,
    "grade" TEXT,
    "totalLessons" INTEGER NOT NULL DEFAULT 12,
    "completedLessons" INTEGER NOT NULL DEFAULT 0,
    "schedule" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "followUp21" TEXT,
    "surveyScore" TEXT,
    "paymentAmount" TEXT,
    "educatorId" TEXT,
    "isListed" BOOLEAN NOT NULL DEFAULT false,
    "offerPrice" TEXT,
    "listingNote" TEXT,
    "soldByName" TEXT,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Student_educatorId_fkey" FOREIGN KEY ("educatorId") REFERENCES "Educator" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Student" ("completedLessons", "createdAt", "educatorId", "email", "followUp21", "grade", "id", "isActive", "isListed", "listingNote", "notes", "offerPrice", "parentName", "parentPhone", "paymentAmount", "schedule", "soldByName", "status", "studentName", "surveyScore", "totalLessons", "updatedAt") SELECT "completedLessons", "createdAt", "educatorId", "email", "followUp21", "grade", "id", "isActive", "isListed", "listingNote", "notes", "offerPrice", "parentName", "parentPhone", "paymentAmount", "schedule", "soldByName", "status", "studentName", "surveyScore", "totalLessons", "updatedAt" FROM "Student";
DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
