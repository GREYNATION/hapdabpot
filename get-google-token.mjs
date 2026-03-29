// Quick OAuth setup script — run once to get GOOGLE_REFRESH_TOKEN
// Usage: node get-google-token.js

import { google } from "googleapis";
import * as readline from "readline";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "253897580352-eeqt8cl08084b5sti210tctjqg72n2fv.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "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";
const REDIRECT_URI = "urn:ietf:wg:oauth:2.0:oob"; // desktop/CLI flow

const SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/presentations",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/calendar",
];

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // forces refresh token to be returned
});

console.log("\n✅ Open this URL in your browser:\n");
console.log(authUrl);
console.log("\n");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question("Paste the code from the browser here: ", async (code) => {
    rl.close();
    try {
        const { tokens } = await oAuth2Client.getToken(code.trim());
        console.log("\n✅ SUCCESS! Add this to your .env:\n");
        console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
        console.log("\nAlso add to Railway Variables: GOOGLE_REFRESH_TOKEN");
        // Save to file so it can be read without terminal truncation
        import("fs").then(fs => {
            fs.writeFileSync("google-token.txt", `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
            console.log("\n✅ Token also saved to google-token.txt");
        });
    } catch (err) {
        console.error("❌ Failed:", err.message);
    }
});
