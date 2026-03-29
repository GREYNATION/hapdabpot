import axios from 'axios';
import { config } from '../src/core/config.js';
import { agentMail } from '../src/services/agentmail.js';
import fs from 'fs';

async function listAll() {
    try {
        const apiKey = config.agentmailApiKey;
        const baseUrl = 'https://api.agentmail.to/v0';
        const headers = { 'Authorization': `Bearer ${apiKey}` };

        let logOutput = '--- LISTING INBOXES ---\n';
        const inboxesResponse = await axios.get(`${baseUrl}/inboxes`, { headers });
        logOutput += JSON.stringify(inboxesResponse.data, null, 2) + '\n\n';
        
        const emails = await agentMail.listMessages(20);
        logOutput += '--- START EMAILS ---\n';
        emails.forEach((e: any) => {
            logOutput += `[${e.timestamp || e.created_at || 'No Date'}] ID: ${e.id || 'No ID'}\n`;
            logOutput += `From: ${e.from}\n`;
            logOutput += `To: ${e.to}\n`;
            logOutput += `Subject: ${e.subject}\n`;
            logOutput += `Body: ${e.body || e.text || e.snippet || '(No body)'}\n`;
            logOutput += '---\n';
        });
        logOutput += `Total emails listed: ${emails.length}\n`;
        logOutput += '--- END EMAILS ---\n';
        
        console.log(logOutput);
        fs.writeFileSync('emails_output.txt', logOutput, 'utf8');
        console.log('Saved to emails_output.txt');
    } catch (e: any) {
        console.error('Error:', e.response?.data || e.message);
    }
}

listAll();
