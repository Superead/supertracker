-- CreateTable
CREATE TABLE "AppointmentCalendar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherName" TEXT NOT NULL,
    "teacherEmail" TEXT,
    "calendarId" TEXT NOT NULL,
    "calendarName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 15,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "meetLink" TEXT,
    "calendarEventId" TEXT,
    "note" TEXT,
    "kommoLeadId" INTEGER,
    "confirmSentAt" DATETIME,
    "confirmError" TEXT,
    "reminderSentAt" DATETIME,
    "reminderError" TEXT,
    "reminderAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdByName" TEXT,
    "calendarRefId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Appointment_calendarRefId_fkey" FOREIGN KEY ("calendarRefId") REFERENCES "AppointmentCalendar" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentCalendar_calendarId_key" ON "AppointmentCalendar"("calendarId");

-- CreateIndex
CREATE INDEX "Appointment_date_status_idx" ON "Appointment"("date", "status");

-- CreateIndex
CREATE INDEX "Appointment_phone_idx" ON "Appointment"("phone");

