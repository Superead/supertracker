-- CreateTable
CREATE TABLE "LessonLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lessonNumber" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "notes" TEXT,
    "studentId" TEXT NOT NULL,
    "educatorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LessonLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LessonLog_educatorId_fkey" FOREIGN KEY ("educatorId") REFERENCES "Educator" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
