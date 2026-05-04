import { google } from 'googleapis';
import readline from 'readline';
import 'dotenv/config';

/**
 * GOOGLE OAUTH HELPER
 * Run this script to regenerate your GOOGLE_REFRESH_TOKEN.
 * 
 * Usage: npx tsx scripts/google-auth-helper.ts
 */

const SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/presentations',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/calendar.events'
];

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost' // Use localhost for local testing
);

async function getRefreshToken() {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent' // Force consent to ensure we get a refresh token
    });

    console.log('\n🚀 Google OAuth Regeneration Helper');
    console.log('====================================');
    console.log('1. Visit this URL in your browser:\n');
    console.log(authUrl);
    console.log('\n2. Authorize the application.');
    console.log('3. You will be redirected to localhost. Copy the "code" parameter from the URL bar.');
    
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    rl.question('\nPaste the "code" here: ', async (code) => {
        try {
            const { tokens } = await oauth2Client.getToken(code);
            console.log('\n✅ Success! New Tokens Generated:');
            console.log('------------------------------------');
            console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
            console.log('------------------------------------');
            console.log('\nACTION: Update your .env and Railway environment variables with this new token.');
        } catch (err: any) {
            console.error('\n❌ Error retrieving tokens:', err.message);
        }
        rl.close();
    });
}

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error('❌ Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env');
} else {
    getRefreshToken().catch(console.error);
}
