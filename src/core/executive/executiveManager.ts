import fs from 'fs';
import path from 'path';
import { log, config } from '../config.js';
import { CrmManager } from '../crm.js';
import { 
    isGoogleEnabled, 
    listEmails, 
    listEvents, 
    driveListFiles 
} from '../../agents/googleWorkspaceAgent.js';
import { sanitizeHTML } from '../telegramUtils.js';

export interface Decision {
    title: string;
    logic: string;
    outcome: string;
    timestamp: string;
}

export class ExecutiveManager {
    private static MEMORY_BASE = path.resolve('./brain/executive');

    /**
     * Workflow #1 & #2: Generate Command Center Briefing
     */
    static async generateMorningBriefing(): Promise<string> {
        log("[executive] Generating Morning Command Center Briefing...");
        
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        
        let report = `☀️ <b>Morning Command Center — ${dateStr}</b>\n\n`;

        // 1. Calendar Prep (Workflow #2)
        if (isGoogleEnabled()) {
            report += `📅 <b>Today's Schedule</b>\n`;
            try {
                const events = await listEvents(1);
                report += events + "\n\n";
            } catch (e: any) {
                report += `⚠️ <b>Calendar error</b>: ${e.message}\n\n`;
            }

            // 2. Email Triage (Workflow #3)
            report += `📩 <b>Email Triage</b>\n`;
            try {
                const emails = await listEmails("is:unread", 5);
                report += emails + "\n\n";
            } catch (e: any) {
                report += `⚠️ <b>Gmail error</b>: ${e.message}\n\n`;
            }
        } else {
            report += `⚠️ Google Workspace not connected. Skipping Calendar/Gmail triage.\n\n`;
        }

        // 3. CRM Snapshot
        const stats = CrmManager.getStats();
        const followUps = CrmManager.getFollowUpsDueToday();
        
        report += `📊 <b>Pipeline Snapshot</b>\n`;
        report += `• <b>Leads</b>: ${stats.leads}\n`;
        report += `• <b>Contacted</b>: ${stats.contacted}\n`;
        report += `• <b>Contracts</b>: ${stats.contracts || 0}\n\n`;

        if (followUps.length > 0) {
            report += `🎯 <b>High-Priority Follow-ups</b>\n`;
            followUps.slice(0, 3).forEach(f => {
                report += `• ${sanitizeHTML(f.address)} (${sanitizeHTML(f.seller_name || 'Prospect')})\n`;
            });
            report += `\n`;
        }

        // 4. Drive Highlights
        if (isGoogleEnabled()) {
            report += `📂 <b>Recent Docs & Activity</b>\n`;
            try {
                const files = await driveListFiles(undefined, 3);
                report += files + "\n";
            } catch (e: any) {
                report += `⚠️ <b>Drive error</b>: ${e.message}\n`;
            }
        }

        // Persistence
        this.saveMemory('briefings', `${dateStr}-briefing.md`, report);
        
        return report;
    }

    /**
     * Workflow #4: Log Critical Decision
     */
    static logDecision(title: string, logic: string, outcome: string): string {
        const decision: Decision = {
            title,
            logic,
            outcome,
            timestamp: new Date().toISOString()
        };

        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `${dateStr}-${title.toLowerCase().replace(/\s+/g, '-')}.md`;
        
        const content = `<b>Decision: ${sanitizeHTML(title)}</b>\n\n` +
            `<b>Date</b>: ${decision.timestamp}\n\n` +
            `<b>Logic & Context</b>\n${sanitizeHTML(logic)}\n\n` +
            `<b>Outcome</b>\n${sanitizeHTML(outcome)}\n`;

        this.saveMemory('decisions', filename, content);
        log(`[executive] Decision logged: ${title}`);
        
        return `✅ Decision logged to memory: ${title}`;
    }

    /**
     * Workflow #3 & #22: Triage Pulse
     */
    static async runTriagePulse(): Promise<string | null> {
        if (!isGoogleEnabled()) return null;
        log("[executive] Running Heartbeat Triage Pulse...");
        
        try {
            const unreadEmails = await listEmails("is:unread", 1);
            
            if (!unreadEmails || unreadEmails.includes("No emails found")) {
                return null;
            }

            // Sanitization happens inside googleWorkspaceAgent's listEmails or we do it here if we want HTML
            return `🔔 <b>Urgent Pulse</b>: Unread high-priority communications detected.\n\n${unreadEmails}`;
        } catch (err: any) {
            if (err.message?.includes("re-authentication") || err.message?.includes("invalid_grant")) {
                return `⚠️ <b>SYSTEM ALERT</b>: Google Workspace disconnected (invalid_grant).\n\n<b>Action Required</b>: Please regenerate your <code>GOOGLE_REFRESH_TOKEN</code> in Railway to restore Gmail/Calendar triage.`;
            }
            log(`[executive] Triage pulse error: ${err.message}`, "error");
            return null;
        }
    }

    /**
     * Helper: Save to Memory Folders
     */
    private static saveMemory(category: 'daily' | 'decisions' | 'projects' | 'briefings', filename: string, content: string) {
        const dir = path.join(this.MEMORY_BASE, category);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        const filePath = path.join(dir, filename);
        fs.writeFileSync(filePath, content);
    }
}

