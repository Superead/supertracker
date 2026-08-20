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

  const notifyEmail = process.env.NOTIFY_EMAIL;
  if (notifyEmail && !attendees.find((a) => a.email === notifyEmail)) {
    attendees.push({ email: notifyEmail });
  }

  const res = await calendar.events.insert({
    calendarId: "primary",
    conferenceDataVersion: 1,
    sendUpdates: "all",
    requestBody: {
      summary: params.summary,
      description: params.description || "",
      start: { dateTime: startDateTime, timeZone: "Europe/Istanbul" },
      end: { dateTime: endDateTime, timeZone: "Europe/Istanbul" },
      attendees,
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

export async function deleteCalendarEvent(eventId: string) {
  if (!REFRESH_TOKEN) return;
  const auth = getOAuth2Client();
  const calendar = google.calendar({ version: "v3", auth });
  try {
    await calendar.events.delete({ calendarId: "primary", eventId });
  } catch {
    // event may already be deleted
  }
}
