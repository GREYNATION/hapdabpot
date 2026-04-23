// Quick OAuth setup script — run once to get GOOGLE_REFRESH_TOKEN
// Usage: node get-google-token.mjs

import { google } from "googleapis";
import * as readline from "readline";
import fs from "fs";
import path from "path";

// Load from client_secret.json
let CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
let CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
let REDIRECT_URI = "http://localhost"; // Match client_secret.json

const secretPath = path.resolve("./client_secret.json");
if (fs.existsSync(secretPath)) {
    try {
        const secretData = JSON.parse(fs.readFileSync(secretPath, "utf-8"));
        const config = secretData.installed || secretData.web;
        if (config) {
            CLIENT_ID = config.client_id;
            CLIENT_SECRET = config.client_secret;
            if (config.redirect_uris && config.redirect_uris[0]) {
                REDIRECT_URI = config.redirect_uris[0];
            }
            console.log("📂 Loaded credentials from client_secret.json");
        }
    } catch (e) {
        console.error("⚠️ Failed to parse client_secret.json:", e.message);
    }
}

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error("❌ ERROR: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing.");
    process.exit(1);
}

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
    prompt: "consent", 
});

console.log("\n🚀 GOOGLE OAUTH RECOVERY\n");
console.log("⚠️  POWERSHELL TIP: Do NOT paste the URL below into this terminal. Just click it.");
console.log("------------------------------------------------------------------");
console.log("1. Open this URL in your browser:\n");
console.log(authUrl);
console.log("\n2. Sign in and authorize the app.");
console.log("3. You will be redirected to a page that fails to load (e.g., http://localhost).");
console.log("4. LOOK AT THE BROWSER ADDRESS BAR. Copy the code after '?code='.");
console.log("   Example: http://localhost/?code=4/0AdQt8... -> Copy '4/0AdQt8...'");
console.log("------------------------------------------------------------------");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question("\n5. Paste the code from the address bar here: ", async (code) => {
    rl.close();
    
    // Clean code in case they pasted the whole URL
    let cleanCode = code.trim();
    if (cleanCode.includes("code=")) {
        cleanCode = new URL(cleanCode).searchParams.get("code") || cleanCode;
    }

    try {
        const { tokens } = await oAuth2Client.getToken(cleanCode);
        console.log("\n✅ SUCCESS! Your new Refresh Token is:\n");
        console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
        
        fs.writeFileSync("google-token.txt", `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
        console.log("\n✅ Token also saved to google-token.txt");
        console.log("\nACTION: Update your Railway environment variables and local .env with this token.");
    } catch (err) {
        console.error("\n❌ Failed to get token:", err.message);
        console.log("\n💡 Possible reasons:");
        console.log("- The code expired (you must paste it within ~1 minute).");
        console.log("- You pasted the whole URL but the parser failed.");
        console.log("- The redirect URI in Cloud Console doesn't match 'http://localhost'.");
    }
});

