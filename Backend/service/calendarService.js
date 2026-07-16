import { google } from "googleapis";

let _oauth2Client = null;

/**
 * Lazily constructs the OAuth2 client on first real use, rather than at
 * module import time. This avoids a common production bug: if this module
 * loads before env vars are actually populated (e.g. right after a redeploy
 * before the process fully restarts), the client gets built once with
 * `undefined` credentials baked in permanently - and simply updating env
 * vars afterward does nothing, since the broken instance stays cached in
 * memory for the life of the process.
 */
export function getOAuthClient() {
    if (_oauth2Client) return _oauth2Client;

    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
        throw new Error(
            "Missing Google OAuth env vars. Check GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, " +
            "GOOGLE_REDIRECT_URI are set on your hosting platform and that the app has been " +
            "restarted/redeployed after setting them."
        );
    }

    _oauth2Client = new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI
    );

    if (process.env.GOOGLE_REFRESH_TOKEN) {
        _oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    }

    return _oauth2Client;
}

/**
 * Creates a calendar event with an auto-generated Google Meet link.
 * The key line is conferenceDataVersion: 1 in the insert params -
 * without it, Google silently ignores the conferenceData request.
 */
export async function scheduleInterview({
    candidateName,
    candidateEmail,
    startTime, // JS Date
    durationMinutes = 30,
    summary,
}) {
    const auth = getOAuthClient();
    const calendar = google.calendar({ version: "v3", auth });

    const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

    const event = {
        summary: summary || `Interview: ${candidateName}`,
        description: `Automated interview scheduling for ${candidateName}`,
        start: { dateTime: startTime.toISOString(), timeZone: "Asia/Kolkata" },
        end: { dateTime: endTime.toISOString(), timeZone: "Asia/Kolkata" },
        attendees: [{ email: candidateEmail }],
        conferenceData: {
            createRequest: {
                requestId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                conferenceSolutionKey: { type: "hangoutsMeet" },
            },
        },
    };

    const response = await calendar.events.insert({
        calendarId: "primary",
        resource: event,
        conferenceDataVersion: 1, // REQUIRED for Meet link generation
        sendUpdates: "all", // emails attendees automatically via Google Calendar invite
    });

    return {
        eventId: response.data.id,
        meetLink: response.data.hangoutLink,
        htmlLink: response.data.htmlLink,
    };
}

export default { scheduleInterview, getOAuthClient };