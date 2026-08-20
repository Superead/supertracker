-- CreateTable
CREATE TABLE "ReadingResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "textNumber" INTEGER NOT NULL,
    "wpm" INTEGER,
    "correct" INTEGER,
    "studentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReadingResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ReadingResult_studentId_textNumber_key" ON "ReadingResult"("studentId", "textNumber");
