-- CreateTable
CREATE TABLE "EducatorRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "score" INTEGER,
    "comment" TEXT,
    "ratedAt" DATETIME,
    "educatorId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EducatorRating_educatorId_fkey" FOREIGN KEY ("educatorId") REFERENCES "Educator" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EducatorRating_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
