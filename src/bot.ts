import "./core/init.js";
import "dotenv/config";
import { processUserInput } from "./taskOrchestrator.js";
import { PropertyScraper } from "./services/PropertyScraper.js";
import { runAutonomousPipeline } from "./core/orchestrator/clawOrchestrator.js";
import { CouncilOrchestrator } from "./core/orchestrator/councilOrchestrator.js";
import { getStuyzaLeads, getStuyzaLeadStats } from "./db/leads.js";
import { db } from "./core/memory.js";

const COMMAND_PREFIX = "/";
const council = new CouncilOrchestrator();

async function handleCommand(input: string, userId: string = "default-user") {
  if (!input.startsWith("/")) return;

  const [command, ...args] = input.slice(1).split(" ");

  switch (command) {
    case "auto":
      const userInput = args.join(" ");
      try {
        const agentResponse = await runAutonomousPipeline(userInput);
        return `🤖 Autonomous Pipeline Complete

${agentResponse}`;
      } catch (err: any) {
        return `🤖 Autonomous Pipeline failed: ${err.message}`;
      }

    case "insights":
      try {
        const targetCity = args[0] || "Houston";
        const { tools } = await import("./core/tools/index.js");
        const { runClawAgent } = await import("./agents/claw/runClaw.js");
        
        const deals = await tools.findDeals({ city: targetCity });
        const insights = await runClawAgent(`
Analyze past deals for ${targetCity}:

${JSON.stringify(deals)}

Which types convert best?
`);
        return `📊 Real Estate Insights (${targetCity})\n\n${insights}`;
      } catch (err: any) {
        return `❌ Insights failed: ${err.message}`;
      }

    case "surplus":
      try {
        const targetCity = args[0] || "Houston";
        const { runSurplusAgent } = await import("./core/surplus/runSurplusAgent.js");
        const opportunities = await runSurplusAgent(targetCity);
        
        return `🏛️ Surveillance Complete
Found ${opportunities.length} high-margin >$10k surplus overages in ${targetCity}. Check your direct DMs for the Alerts!`;
      } catch (err: any) {
        return `❌ Surplus run failed: ${err.message}`;
      }
case "prompts":
      try {
        const { handlePromptsCommand } = await import("./agents/promptsAgent/promptsAgent.js");
        const promptsResult = await handlePromptsCommand(args.join(" "));
        return promptsResult;
      } catch (err: any) {
        return `❌ Prompts command failed: ${err.message}`;
      }

    case "n8n":
    case "n8n":
      try {
        const { handleN8nCommand } = await import("./agents/n8nAgent/n8nAgent.js");
        const n8nResult = await handleN8nCommand(args.join(" "));
        return n8nResult;
      } catch (err: any) {
        return `❌ n8n command failed: ${err.message}`;
      }

    case "build":

      const result = await processUserInput(args.join(" "), userId);
      return result.response;

    case "scrape":
      const url = args[0];
      if (!url) {
        return "❌ Please provide a URL to scrape. Usage: /scrape [url]";
      }
      const data = await PropertyScraper.scrapeListings(url);
      if (data.length === 0) {
        return "❌ No listings found. Check the URL or CSS selectors.";
      }
      return data.map((p, i) => `${i + 1}. ${p.title}\n   💰 ${p.price}\n   📍 ${p.address}\n   🔗 ${p.link}`).join("\n\n");

    case "agents":
      return listAgents();

      case "leads":
      try {
        const stats = getStuyzaLeadStats(db);
        const leads = getStuyzaLeads(db, 10);
        
        let report = `📈 **STUYZA LEAD PIPELINE**\n`;
        report += `Total: ${stats.total} | New: ${stats.new_leads || 0} | Booked: ${stats.booked || 0}\n\n`;
        
        if (leads.length === 0) {
          report += "_No leads captured yet._";
        } else {
          leads.forEach((l: any, i: number) => {
            report += `${i+1}. **${l.fname}** - ${l.service || 'N/A'}\n`;
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

    default:
      // FALLBACK TO COUNCIL CHAT
      const chatInput = input.startsWith("/") ? input.slice(1) : input;
      try {
        return await council.chat(chatInput, parseInt(userId) || 0);
      } catch (err: any) {
        return `❌ Council failed to respond: ${err.message}`;
      }
  }
}

function listAgents() {
  return [
    "📍 Council (Default Chat) - Multi-agent hierarchical swarm",
    "📍 Ops Intelligence - Mission tracking & SOPs",
    "📍 Comms Lead - Outreach & messaging",
    "📍 Strategic Finance - ROI & MAO audits",
    "🤖 ClawAgent - Autonomous command execution (/auto)"
  ].join("\n");
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log("🤖 Gravity Claw CLI Bot");
    console.log("Usage:");
    console.log("  npm run bot -- /scrape [url]");
    console.log("  npm run bot -- /build [task]");
    console.log("  npm run bot -- /agents");
    return;
  }

  let input = args.join(" ");
  
  // Fix Git Bash path conversion issue
  if (input.includes("Program Files/Git/")) {
    input = input.replace("C:/Program Files/Git/", "/");
  }
  
  if (!input.startsWith("/")) {
    input = "/" + input;
  }

  try {
    const result = await handleCommand(input);
    console.log(result);
  } catch (error) {
    console.error("Error:", error);
  }
}

// Export for use as a module
export { handleCommand, listAgents };

// Run if this file is executed directly
main();
