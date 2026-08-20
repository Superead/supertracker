-- CreateTable
CREATE TABLE "Educator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "iban" TEXT,
    "userId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Educator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Student" (
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
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Student_educatorId_fkey" FOREIGN KEY ("educatorId") REFERENCES "Educator" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Educator_userId_key" ON "Educator"("userId");
