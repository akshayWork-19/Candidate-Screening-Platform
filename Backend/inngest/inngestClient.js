import { Inngest } from "inngest";

if (!process.env.INNGEST_EVENT_KEY) {
    console.warn(
        "[inngest] WARNING: INNGEST_EVENT_KEY is not set. Events will not be sent " +
        "to Inngest Cloud in production. Check your hosting platform's env vars " +
        "and confirm you've redeployed since setting it."
    );
}

export const inngest = new Inngest({
    id: "myn-screener",
    eventKey: process.env.INNGEST_EVENT_KEY, // required in production; dev mode ignores this
});

// Defensive: if the key becomes available after this module already loaded
// (e.g. a race during cold start), this lets it be set again at runtime.
if (process.env.INNGEST_EVENT_KEY) {
    inngest.setEventKey(process.env.INNGEST_EVENT_KEY);
}