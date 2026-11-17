-- AlterTable
ALTER TABLE "Student" ADD COLUMN "kommoLeadId" INTEGER;

-- CreateTable
CREATE TABLE "PlannedLesson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonNumber" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "meetLink" TEXT,
    "calendarEventId" TEXT,
    "reminderSentAt" DATETIME,
    "reminderError" TEXT,
    "reminderAttempts" INTEGER NOT NULL DEFAULT 0,
    "studentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlannedLesson_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PlannedLesson_date_status_idx" ON "PlannedLesson"("date", "status");

-- CreateIndex
CREATE INDEX "PlannedLesson_studentId_idx" ON "PlannedLesson"("studentId");

