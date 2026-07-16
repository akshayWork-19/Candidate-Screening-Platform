import { google } from "googleapis";

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

// Set once you've completed the one-time OAuth consent flow (see auth.js route)
// and copied the refresh_token into .env - it does not expire unless revoked.
oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const calendar = google.calendar({ version: "v3", auth: oauth2Client });

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

export default oauth2Client;