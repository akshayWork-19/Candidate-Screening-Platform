import express from "express";
import { getOAuthClient } from "../service/calendarService.js";

const router = express.Router();

// Step 1: visit this route in your browser once, log in with the Google account
// you want interviews scheduled from, and approve calendar access.
router.get("/google", (req, res) => {
    try {
        const oauth2Client = getOAuthClient();
        const url = oauth2Client.generateAuthUrl({
            access_type: "offline", // required to get a refresh_token back
            prompt: "consent", // forces refresh_token even on repeat auth
            scope: ["https://www.googleapis.com/auth/calendar.events"],
        });
        res.redirect(url);
    } catch (err) {
        res.status(500).send(`Auth setup failed: ${err.message}`);
    }
});

// Step 2: Google redirects here with a ?code=... param
router.get("/google/callback", async (req, res) => {
    try {
        const { code } = req.query;
        const oauth2Client = getOAuthClient();
        const { tokens } = await oauth2Client.getToken(code);
        // Copy this refresh_token into your .env as GOOGLE_REFRESH_TOKEN
        res.send(`
      <h2>Copy this into your .env as GOOGLE_REFRESH_TOKEN:</h2>
      <pre>${tokens.refresh_token}</pre>
      <p>(If refresh_token is missing, revoke app access at
      myaccount.google.com/permissions and retry - Google only issues it
      on first consent.)</p>
    `);
    } catch (err) {
        res.status(500).send(`Auth failed: ${err.message}`);
    }
});

export default router;