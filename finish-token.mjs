import { google } from "googleapis";
import fs from "fs";

const CLIENT_ID = "86251190290-qa3lfqb4p11j3h3ck2h286pu3ergrcl8.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REDIRECT_URI = "http://localhost";
const CODE = "4/0Aci98E-DsF_oMX8CD2oLF_0_u-vp6FYBbxl23Dx3pq9qD7zEgHm-ByO8wf9eHmg6-qVwLg";

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

async function exchange() {
    try {
        const { tokens } = await oAuth2Client.getToken(CODE);
        console.log("\n✅ SUCCESS! Your permanent Refresh Token is:\n");
        console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
        
        fs.writeFileSync("google-token.txt", `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
        console.log("\n✅ Token saved to google-token.txt");
    } catch (err) {
        console.error("❌ Error exchanging code:", err.message);
    }
}

exchange();
