import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { getDb } from './db/index.js';
import { getStuyzaLeads, getStuyzaLeadStats, getStuyzaLeadById, updateStuyzaLeadStatus } from './db/leads.js';
import { quickZillowSearch } from './services/universalLeadScraper.js';
import { AutomationService } from './services/automationService.js';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("❌ TELEGRAM_BOT_TOKEN not found in .env");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const db = getDb();
const automation = new AutomationService();

console.log("🚀 Hermes Acquisition Bot is online!");

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "🔥 **Hermes Acquisition Engine v1.0**\n\nCommands:\n/leads - View latest Stuyza leads\n/scrape [url] - Quick Zillow scrape\n/10x [cmd] - Hyper-Automation Scaling", { parse_mode: 'Markdown' });
});

bot.onText(/\/(leads|scrape|10x)(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const command = match?.[1];
  const args = match?.[2]?.trim().split(" ") || [];

  bot.sendMessage(chatId, "⏳ Processing request...");

  const response = await handleCommand(command || "", args);
  bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
});

async function handleCommand(cmd: string, args: string[]): Promise<string> {
  switch (cmd) {
    case "scrape":
      if (!args[0]) return "❌ Please provide a Zillow URL.";
      try {
        const lead = await quickZillowSearch(args[0]);
        if (!lead) return "❌ No data found or blocked by Zillow.";
        return `✅ **Zillow Lead Captured**\n\n**Address:** ${lead.address}\n**Price:** ${lead.price}\n**Agent:** ${lead.agent_name || 'N/A'}`;
      } catch (err: any) {
        return `❌ Scrape failed: ${err.message}`;
      }

    case "leads":
      try {
        const stats = getStuyzaLeadStats(db);
        const leads = getStuyzaLeads(db, 10);
        
        let report = `📊 **STUYZA LEAD PIPELINE**\n`;
        report += `Total: ${stats.total} | New: ${stats.new_leads || 0} | Booked: ${stats.booked || 0}\n\n`;
        
        if (leads.length === 0) {
          report += "_No leads captured yet._";
        } else {
          leads.forEach((l: any, i: number) => {
            report += `${i+1}. [${l.id}] **${l.fname}** - ${l.service || 'N/A'}\n`;
            report += `   📧 ${l.email} | 📱 ${l.phone || 'N/A'}\n`;
            report += `   🏢 ${l.biz_type || 'N/A'}\n`;
            if (l.notes) report += `   📝 ${l.notes}\n`;
            report += `   📅 ${l.created_at}\n\n`;
          });
        }
        return report;
      } catch (err: any) {
        return `❌ Failed to fetch leads: ${err.message}`;
      }

    case "10x":
      const [subCommand, ...subArgs] = args;
      try {
        const { runHyperAutomationFlow } = await import("./agents/hyperAutomationAgent.js");

        if (subCommand === "research") {
          const niche = subArgs.join(" ") || "Real Estate";
          const res = await runHyperAutomationFlow("research_hub", { niche });
          let report = `🔍 **10X RESEARCH HUB: ${niche.toUpperCase()}**\n\n`;
          res.outliers.forEach((o: any, i: number) => {
            report += `${i+1}. **Format:** ${o.format}\n   **Hook:** ${o.hook}\n   **Why:** ${o.reason}\n\n`;
          });
          return report;
        }

        if (subCommand === "scrape") {
          const url = subArgs[0];
          const niche = subArgs.slice(1).join(" ") || "Real Estate";
          const res = await runHyperAutomationFlow("scrape_to_script", { url, niche });
          return `🔥 **10X CONTENT GENERATED**\n\n**Niche:** ${niche}\n**Script:**\n${res.script}\n\n✅ Saved to Unified Vault.`;
        }

        if (subCommand === "batch") {
          const niche = subArgs.join(" ") || "Real Estate";
          const res = await runHyperAutomationFlow("batch_production", { niche, count: 5 });
          let report = `🏭 **10X CONTENT FACTORY: 5 SCRIPTS READY**\n\n`;
          res.scripts.forEach((s: any, i: number) => {
            report += `📜 **Script ${i+1}:**\n${s.substring(0, 100)}...\n\n`;
          });
          report += "✅ View full scripts in /dashboard";
          return report;
        }

        if (subCommand === "qualify") {
          const leadId = parseInt(subArgs[0]);
          const lead = getStuyzaLeadById(db, leadId);
          if (!lead) return `❌ Lead #${leadId} not found.`;
          
          const res = await runHyperAutomationFlow("qualify", { lead, history: ["Customer asked about pricing.", "We explained the value prop."] });
          const q = (res as any).qualification;
          
          let response = `🤖 **AI SETTER EVALUATION (#${leadId})**\n\n`;
          response += `**Big Fish?** ${q.qualified ? "✅ YES" : "❌ NO"}\n`;
          response += `**Reasoning:** ${q.reasoning}\n`;
          response += `**Next Step:** ${q.next_step}`;
          
          if (q.qualified) {
            updateStuyzaLeadStatus(db, leadId, "qualified");
          }
          return response;
        }

        if (subCommand === "objections") {
          const res = await runHyperAutomationFlow("objection_analysis", { transcripts: ["Seller said they are not in a rush.", "Seller asked if we are a wholesaler."] });
          return `💰 **10X CONVERSION LAB: OBJECTION REPORT**\n\n${res.analysis}`;
        }

        return "❌ Unknown 10x command. Try: research, scrape, batch, qualify, objections";
      } catch (err: any) {
        return `❌ Hyper-Automation failed: ${err.message}`;
      }

    default:
      return "❌ Unknown command.";
  }
}
