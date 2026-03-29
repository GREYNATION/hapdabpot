// ============================================================
// Google Workspace Agent
// Drive, Docs, Slides, Sheets, Gmail, Calendar â€” all via
// googleapis Node.js client with OAuth2 refresh token
// ============================================================

import { google } from "googleapis";
import { log } from "../core/config.js";

// â”€â”€ Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getAuth() {
    const oAuth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        "urn:ietf:wg:oauth:2.0:oob"
    );
    oAuth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return oAuth2Client;
}

export function isGoogleEnabled(): boolean {
    return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);
}

// â”€â”€ DRIVE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function driveListFiles(query?: string, maxResults = 10): Promise<string> {
    const drive = google.drive({ version: "v3", auth: getAuth() });
    const res = await drive.files.list({
        q: query ?? "trashed=false",
        pageSize: maxResults,
        fields: "files(id, name, mimeType, modifiedTime, webViewLink)",
        orderBy: "modifiedTime desc",
    });
    const files = res.data.files ?? [];
    if (files.length === 0) return "ðŸ“‚ No files found.";
    return files.map((f: {name?: string|null; mimeType?: string|null; webViewLink?: string|null}, i: number) =>
        `${i + 1}. ðŸ“„ ${f.name}\n   Type: ${f.mimeType?.split(".").pop()}\n   ðŸ”— ${f.webViewLink}`
    ).join("\n\n");
}

export async function driveSearch(query: string): Promise<string> {
    return driveListFiles(`name contains '${query}' and trashed=false`);
}

// â”€â”€ DOCS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function readDoc(docId: string): Promise<string> {
    const docs = google.docs({ version: "v1", auth: getAuth() });
    const res = await docs.documents.get({ documentId: docId });
    const content = res.data.body?.content ?? [];
    const text = content
        .flatMap((el: any) => el.paragraph?.elements ?? [])
        .map((el: any) => el.textRun?.content ?? "")
        .join("");
    return text.trim() || "ðŸ“„ Document is empty.";
}

export async function createDoc(title: string, content: string): Promise<string> {
    const docs = google.docs({ version: "v1", auth: getAuth() });
    const doc = await docs.documents.create({ requestBody: { title } });
    const docId = doc.data.documentId!;
    await docs.documents.batchUpdate({
        documentId: docId,
        requestBody: {
            requests: [{ insertText: { location: { index: 1 }, text: content } }],
        },
    });
    return `âœ… Doc created: https://docs.google.com/document/d/${docId}/edit`;
}

// â”€â”€ SLIDES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function createPresentation(title: string, slides: string[]): Promise<string> {
    const slidesApi = google.slides({ version: "v1", auth: getAuth() });
    const pres = await slidesApi.presentations.create({ requestBody: { title } });
    const presId = pres.data.presentationId!;

    const requests: any[] = slides.map((text) => ({
        createSlide: {
            slideLayoutReference: { predefinedLayout: "TITLE_AND_BODY" },
            placeholderIdMappings: [],
        },
    }));

    if (requests.length > 0) {
        await slidesApi.presentations.batchUpdate({
            presentationId: presId,
            requestBody: { requests },
        });
    }

    return `âœ… Presentation created: https://docs.google.com/presentation/d/${presId}/edit\nðŸ“Š ${slides.length} slide(s) added.`;
}

// â”€â”€ SHEETS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function appendSheet(spreadsheetId: string, values: string[][]): Promise<string> {
    const sheets = google.sheets({ version: "v4", auth: getAuth() });
    const res = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Sheet1",
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
    });
    return `âœ… Appended ${values.length} row(s) to sheet.`;
}

export async function createSheet(title: string): Promise<string> {
    const sheets = google.sheets({ version: "v4", auth: getAuth() });
    const res = await sheets.spreadsheets.create({
        requestBody: { properties: { title } },
    });
    const id = res.data.spreadsheetId!;
    return `âœ… Sheet created: https://docs.google.com/spreadsheets/d/${id}/edit`;
}

// â”€â”€ GMAIL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function listEmails(query = "is:unread", maxResults = 5): Promise<string> {
    const gmail = google.gmail({ version: "v1", auth: getAuth() });
    const list = await gmail.users.messages.list({ userId: "me", q: query, maxResults });
    const messages = list.data.messages ?? [];
    if (messages.length === 0) return "ðŸ“­ No emails found.";

    const details = await Promise.all(messages.map(async (m) => {
        const msg = await gmail.users.messages.get({ userId: "me", id: m.id!, format: "metadata", metadataHeaders: ["From", "Subject", "Date"] });
        const headers = msg.data.payload?.headers ?? [];
        const get = (name: string) => headers.find((h: any) => h.name === name)?.value ?? "N/A";
        return `ðŸ“§ From: ${get("From")}\n   Subject: ${get("Subject")}\n   Date: ${get("Date")}`;
    }));

    return details.join("\n\n");
}

export async function sendEmail(to: string, subject: string, body: string): Promise<string> {
    const gmail = google.gmail({ version: "v1", auth: getAuth() });
    const raw = Buffer.from(
        `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`
    ).toString("base64url");
    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
    return `âœ… Email sent to ${to}`;
}

// â”€â”€ CALENDAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function listEvents(days = 7): Promise<string> {
    const calendar = google.calendar({ version: "v3", auth: getAuth() });
    const now = new Date();
    const end = new Date(now.getTime() + days * 86_400_000);
    const res = await calendar.events.list({
        calendarId: "primary",
        timeMin: now.toISOString(),
        timeMax: end.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 10,
    });
    const events = res.data.items ?? [];
    if (events.length === 0) return `ðŸ“… No events in the next ${days} day(s).`;
    return events.map((e: {summary?: string|null; start?: {dateTime?: string|null; date?: string|null}}, i: number) => {
        const start = e.start?.dateTime ?? e.start?.date ?? "?";
        return `${i + 1}. ðŸ“… ${e.summary}\n   ðŸ• ${new Date(start).toLocaleString()}`;
    }).join("\n\n");
}

export async function createEvent(title: string, startIso: string, endIso: string): Promise<string> {
    const calendar = google.calendar({ version: "v3", auth: getAuth() });
    const res = await calendar.events.insert({
        calendarId: "primary",
        requestBody: {
            summary: title,
            start: { dateTime: startIso, timeZone: "America/New_York" },
            end: { dateTime: endIso, timeZone: "America/New_York" },
        },
    });
    return `âœ… Event created: ${res.data.htmlLink}`;
}

