import fs from 'fs';
import path from 'path';

import { Lead } from "../types/lead.js";

/**
 * Vault Service for managing real estate leads and strategy notes in an Obsidian-compatible structure.
 */

// Root of the Obsidian vault.
const VAULT_ROOT = path.join(process.cwd(), 'Vault'); 

const folders = [
    '00_Hermes_Briefings',
    '01_Hot_Leads',
    '02_Buyers',
    '03_Strategy',
    '04_Archive'
];

/**
 * Initializes the Vault directory structure.
 */
export function initVault() {
    if (!fs.existsSync(VAULT_ROOT)) {
        fs.mkdirSync(VAULT_ROOT, { recursive: true });
    }
    folders.forEach(f => {
        const p = path.join(VAULT_ROOT, f);
        if (!fs.existsSync(p)) {
            fs.mkdirSync(p, { recursive: true });
        }
    });
}

/**
 * Saves a real estate lead to an Obsidian markdown file.
 * @param lead The lead object containing property and owner details.
 */
export function saveLeadToObsidian(lead: Lead) {
    // Sanitize filename to prevent invalid characters
    const address = lead.address || "Unknown Address";
    const fileName = `${address.replace(/[/\\?%*:|"<>]/g, '-')}.md`;
    const filePath = path.join(VAULT_ROOT, '01_Hot_Leads', fileName);

    const signals = lead.distressSignals || [];
    const distressType = lead.type || (signals.length > 0 ? signals[0] : "Unknown");
    const score = lead.dealScore || 0;
    const mao = lead.maxOffer || 0;
    const arv = lead.arv || 0;
    const repairs = lead.repairs || 0;
    const absentee = signals.some(s => s && String(s).toLowerCase()?.includes("absentee")) ? "âœ… Yes" : "âŒ No";

    const content = `---
tags: [lead, ${distressType.replace(/\s+/g, '_')}, status/new]
score: ${score}
mao: ${mao}
date: ${new Date().toISOString().split('T')[0]}
---
# ${lead.address}

## ðŸ“Š Deal Info
- **Distress:** ${distressType}
- **Score:** ${score}
- **Estimated ARV:** $${arv.toLocaleString()}
- **Estimated Repairs:** $${repairs.toLocaleString()}
- **MAO:** $${mao.toLocaleString()}

## ðŸ‘¤ Owner Details
- **Name:** ${lead.owner || "Unknown"}
- **Absentee:** ${absentee}

## ðŸ“ž Scripts
- [[Cold Call Scripts#${distressType}]]

## ðŸ“ Description
${lead.description || "No description provided."}

## ðŸ”— Source
[View Listing](${lead.url || "#"})
`;

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, content);
    console.log(`ðŸ“ Note created: ${fileName}`);
}

/**
 * Reads all strategy markdown files to provide context for adaptive behavior.
 * @returns Combined text content of all strategy notes.
 */
export function getStrategyContext(): string {
    const strategyPath = path.join(VAULT_ROOT, '03_Strategy');
    if (!fs.existsSync(strategyPath)) return "";

    try {
        const files = fs.readdirSync(strategyPath);
        let context = "";
        files.forEach(file => {
            if (file.endsWith('.md')) {
                context += fs.readFileSync(path.join(strategyPath, file), 'utf8') + "\n";
            }
        });
        return context;
    } catch (error) {
        console.error("Error reading strategy context:", error);
        return "";
    }
}

/**
 * Logs a scraper error to the System_Health note in the Vault.
 * @param site The site or service that failed.
 * @param error The error message.
 */
export function logScraperError(site: string, error: string | null | undefined) {
    const filePath = path.join(VAULT_ROOT, '03_Strategy', 'System_Health.md');
    const timestamp = new Date().toLocaleString();
    // ðŸ›¡ï¸ Guard: error may be null/undefined for certain network-level axios failures
    const safeError = (error ?? "unknown error");
    const logEntry = `\n- [ ] **${timestamp}**: ${site} failed with ${safeError}. Need to check headers.`;
    
    // Ensure the directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.appendFileSync(filePath, logEntry);
    console.log(`âš ï¸ Scraper error logged to System_Health: ${site}`);
}

