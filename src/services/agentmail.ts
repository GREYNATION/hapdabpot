import axios from 'axios';
import { config, log } from '../core/config.js';

export interface EmailMessage {
    id: string;
    from: string;
    to: string;
    subject: string;
    body: string;
    html?: string;
    timestamp: string;
}

export class AgentMailService {
    private apiKey: string;
    private baseUrl = 'https://api.agentmail.to/v0';
    private inboxId: string | null = null;
    private email: string;

    constructor() {
        this.apiKey = config.agentmailApiKey || '';
        this.email = config.agentmailEmail || '';
    }

    private get headers() {
        return {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
        };
    }

    private async ensureInboxId(): Promise<string> {
        if (this.inboxId) return this.inboxId;
        
        try {
            log(`[agentmail] Discovering inbox ID for ${this.email}...`);
            const response = await axios.get(`${this.baseUrl}/inboxes`, { headers: this.headers });
            const data = response.data;
            const inboxes = Array.isArray(data) ? data : (data.inboxes || data.data || []);
            
            const inbox = Array.isArray(inboxes) ? inboxes.find((i: any) => i.email === this.email || i.address === this.email || i.inbox_id === this.email) : null;
            
            if (!inbox) {
                // If not found, try to use the first one available
                if (Array.isArray(inboxes) && inboxes.length > 0) {
                    this.inboxId = inboxes[0].inbox_id || inboxes[0].id;
                    log(`[agentmail] Email match fail, using first inbox: ${inboxes[0].email} (ID: ${this.inboxId})`);
                } else {
                    throw new Error(`No inboxes found for account. Response: ${JSON.stringify(inboxes)}`);
                }
            } else {
                this.inboxId = inbox.inbox_id || inbox.id;
                log(`[agentmail] Found inbox ID: ${this.inboxId}`);
            }
            
            return this.inboxId!;
        } catch (e: any) {
            log(`[agentmail] Error discovering inbox: ${e.response?.data?.message || e.message}`, 'error');
            throw e;
        }
    }

    async sendEmail(to: string, subject: string, body: string, html?: string): Promise<any> {
        if (!this.apiKey) throw new Error('AgentMail API Key missing');
        const id = await this.ensureInboxId();
        
        try {
            log(`[agentmail] Sending email from ${id} to ${to}: ${subject}`);
            const response = await axios.post(`${this.baseUrl}/inboxes/${id}/messages/send`, {
                to: [to], // Some APIs expect array
                subject,
                text: body,
                html: html || body.replace(/\n/g, '<br>')
            }, { headers: this.headers });
            
            return response.data;
        } catch (e: any) {
            log(`[agentmail] Error sending email: ${e.response?.data?.message || e.message}`, 'error');
            throw e;
        }
    }

    async listMessages(limit = 10): Promise<EmailMessage[]> {
        if (!this.apiKey) throw new Error('AgentMail API Key missing');
        const id = await this.ensureInboxId();
        
        try {
            log(`[agentmail] Listing last ${limit} messages for ${id}`);
            const response = await axios.get(`${this.baseUrl}/inboxes/${id}/messages`, {
                params: { limit },
                headers: this.headers
            });
            
            return response.data.data || response.data.messages || [];
        } catch (e: any) {
            log(`[agentmail] Error listing messages: ${e.response?.data?.message || e.message}`, 'error');
            throw e;
        }
    }

    async getMessage(messageId: string): Promise<EmailMessage> {
        if (!this.apiKey) throw new Error('AgentMail API Key missing');
        const id = await this.ensureInboxId();
        
        try {
            const response = await axios.get(`${this.baseUrl}/inboxes/${id}/messages/${messageId}`, {
                headers: this.headers
            });
            return response.data;
        } catch (e: any) {
            log(`[agentmail] Error getting message ${messageId}: ${e.response?.data?.message || e.message}`, 'error');
            throw e;
        }
    }
}

export const agentMail = new AgentMailService();
