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

export interface Decision {
    title: string;
    logic: string;
    outcome: string;
    timestamp: string;
}

export class ExecutiveManager {
    private static MEMORY_BASE = path.resolve('./data/memory');

    /**
     * Workflow #1 & #2: Generate Command Center Briefing
     */
    static async generateMorningBriefing(): Promise<string> {
        log("[executive] Generating Morning Command Center Briefing...");
        
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        
        let report = `# 🌅 Morning Command Center — ${dateStr}\n\n`;

        // 1. Calendar Prep (Workflow #2)
        if (isGoogleEnabled()) {
            report += `## 📅 Today's Schedule\n`;
            try {
                const events = await listEvents(1);
                report += events + "\n\n";
            } catch (e: any) {
                report += `⚠️ Calendar error: ${e.message}\n\n`;
            }

            // 2. Email Triage (Workflow #3)
            report += `## 📩 Email Triage\n`;
            try {
                const emails = await listEmails("is:unread", 5);
                report += emails + "\n\n";
            } catch (e: any) {
                report += `⚠️ Gmail error: ${e.message}\n\n`;
            }
        } else {
            report += `⚠️ Google Workspace not connected. Skipping Calendar/Gmail triage.\n\n`;
        }

        // 3. CRM Snapshot
        const stats = CrmManager.getStats();
        const followUps = CrmManager.getFollowUpsDueToday();
        
        report += `## 🏗️ Pipeline Snapshot\n`;
        report += `- **Leads**: ${stats.leads}\n`;
        report += `- **Contacted**: ${stats.contacted}\n`;
        report += `- **Contracts**: ${stats.contracts || 0}\n\n`;

        if (followUps.length > 0) {
            report += `### 🎯 High-Priority Follow-ups\n`;
            followUps.slice(0, 3).forEach(f => {
                report += `- ${f.address} (${f.seller_name || 'Prospect'})\n`;
            });
            report += `\n`;
        }

        // 4. Drive Highlights
        if (isGoogleEnabled()) {
            report += `## 📂 Recent Docs & Activity\n`;
            try {
                const files = await driveListFiles(undefined, 3);
                report += files + "\n";
            } catch (e: any) {
                report += `⚠️ Drive error: ${e.message}\n`;
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
        
        const content = `# Decision: ${title}\n\n` +
            `**Date**: ${decision.timestamp}\n\n` +
            `## Logic & Context\n${logic}\n\n` +
            `## Outcome\n${outcome}\n`;

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
            const unreadCount = await listEmails("is:unread", 1);
            
            if (unreadCount.includes("No emails found")) {
                return null;
            }

            return `🔔 **Urgent Pulse**: Unread high-priority communications detected.\n\n${unreadCount}`;
        } catch (err: any) {
            if (err.message?.includes("re-authentication")) {
                return `⚠️ **SYSTEM ALERT**: Google Workspace disconnected (invalid_grant).\n\n**Action Required**: Please regenerate your \`GOOGLE_REFRESH_TOKEN\` in Railway to restore Gmail/Calendar triage.`;
            }
            throw err;
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
