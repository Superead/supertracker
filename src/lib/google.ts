import { google } from "googleapis";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

export function getOAuth2Client() {
  const client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  if (REFRESH_TOKEN) {
    client.setCredentials({ refresh_token: REFRESH_TOKEN });
  }
  return client;
}

export function getAuthUrl() {
  const client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.events"],
  });
}

export async function createCalendarEvent(params: {
  summary: string;
  description?: string;
  date: string;
  time: string;
  durationMinutes?: number;
  attendeeEmails?: string[];
  calendarId?: string;
  /** false: NOTIFY_EMAIL davetli olarak eklenmez. */
  notify?: boolean;
}) {
  if (!REFRESH_TOKEN) return null;

  const auth = getOAuth2Client();
  const calendar = google.calendar({ version: "v3", auth });

  const startDateTime = `${params.date}T${params.time}:00+03:00`;
  const duration = params.durationMinutes || 60;
  const endMs = new Date(startDateTime).getTime() + duration * 60000;
  const endTR = new Date(endMs + 3 * 3600000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const endDateTime = `${endTR.getUTCFullYear()}-${pad(endTR.getUTCMonth() + 1)}-${pad(endTR.getUTCDate())}T${pad(endTR.getUTCHours())}:${pad(endTR.getUTCMinutes())}:00+03:00`;

  const attendees = (params.attendeeEmails || [])
    .filter(Boolean)
    .map((email) => ({ email }));

  const notifyEmail = params.notify === false ? null : process.env.NOTIFY_EMAIL;
  if (notifyEmail && !attendees.find((a) => a.email === notifyEmail)) {
    attendees.push({ email: notifyEmail });
  }

  const res = await calendar.events.insert({
    calendarId: params.calendarId || "primary",
    conferenceDataVersion: 1,
    sendUpdates: "all",
    requestBody: {
      summary: params.summary,
      description: params.description || "",
      start: { dateTime: startDateTime, timeZone: "Europe/Istanbul" },
      end: { dateTime: endDateTime, timeZone: "Europe/Istanbul" },
      attendees,
      // Takvim sahibinin bildirimleri; davetliler kendi takvim varsayılanlarına göre bildirim alır.
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 },
          { method: "popup", minutes: 60 },
        ],
      },
      conferenceData: {
        createRequest: {
          requestId: `supertracker-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    },
  });

  return {
    eventId: res.data.id,
    meetLink: res.data.hangoutLink || null,
    htmlLink: res.data.htmlLink || null,
  };
}

/** Dersi başka gün/saate taşır; davetlilere güncelleme gider. */
export async function updateCalendarEventTime(eventId: string, date: string, time: string, durationMinutes = 60) {
  if (!REFRESH_TOKEN) return;
  const auth = getOAuth2Client();
  const calendar = google.calendar({ version: "v3", auth });
  const startDateTime = `${date}T${time}:00+03:00`;
  const endTR = new Date(new Date(startDateTime).getTime() + durationMinutes * 60000 + 3 * 3600000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const endDateTime = `${endTR.getUTCFullYear()}-${pad(endTR.getUTCMonth() + 1)}-${pad(endTR.getUTCDate())}T${pad(endTR.getUTCHours())}:${pad(endTR.getUTCMinutes())}:00+03:00`;
  await calendar.events.patch({
    calendarId: "primary",
    eventId,
    sendUpdates: "all",
    requestBody: {
      start: { dateTime: startDateTime, timeZone: "Europe/Istanbul" },
      end: { dateTime: endDateTime, timeZone: "Europe/Istanbul" },
    },
  });
}

export async function deleteCalendarEvent(eventId: string, calendarId = "primary") {
  if (!REFRESH_TOKEN) return;
  const auth = getOAuth2Client();
  const calendar = google.calendar({ version: "v3", auth });
  try {
    await calendar.events.delete({ calendarId, eventId, sendUpdates: "all" });
  } catch {
    // event may already be deleted
  }
}

/** Takvimin adını döndürür (erişim yoksa hata fırlatır). */
export async function getCalendarName(calendarId: string): Promise<string | null> {
  if (!REFRESH_TOKEN) throw new Error("Google Takvim bağlı değil");
  const calendar = google.calendar({ version: "v3", auth: getOAuth2Client() });
  const res = await calendar.events.list({ calendarId, maxResults: 1 });
  return res.data.summary || null;
}

/**
 * Bir günün dolu aralıkları (Türkiye saati, dakika cinsinden 0–1440).
 * Saatli ve "meşgul" görünen etkinlikler sayılır; tüm gün etkinlikleri ve "boş" işaretliler sayılmaz.
 */
export async function getBusyIntervals(calendarId: string, date: string): Promise<{ start: number; end: number; title: string }[]> {
  if (!REFRESH_TOKEN) throw new Error("Google Takvim bağlı değil");
  const calendar = google.calendar({ version: "v3", auth: getOAuth2Client() });
  const dayStart = new Date(`${date}T00:00:00+03:00`).getTime();
  const res = await calendar.events.list({
    calendarId,
    timeMin: new Date(dayStart).toISOString(),
    timeMax: new Date(dayStart + 24 * 3600000).toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250,
  });
  const out: { start: number; end: number; title: string }[] = [];
  for (const e of res.data.items || []) {
    if (e.status === "cancelled" || e.transparency === "transparent") continue;
    if (!e.start?.dateTime || !e.end?.dateTime) continue; // tüm gün etkinliği
    const s = (new Date(e.start.dateTime).getTime() - dayStart) / 60000;
    const en = (new Date(e.end.dateTime).getTime() - dayStart) / 60000;
    out.push({ start: Math.max(0, s), end: Math.min(1440, en), title: e.summary || "" });
  }
  return out;
}
