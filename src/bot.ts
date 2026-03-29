import "dotenv/config";
import { processUserInput } from "./taskOrchestrator.js";
import { PropertyScraper } from "./services/PropertyScraper.js";

const COMMAND_PREFIX = "/";

async function handleCommand(input: string, userId: string = "default-user") {
  if (!input.startsWith("/")) return;

  const [command, ...args] = input.slice(1).split(" ");

  switch (command) {
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

    default:
      return "❌ Unknown command. Available: /build, /scrape, /agents";
  }
}

function listAgents() {
  return [
    "📝 DeveloperAgent - Software development",
    "📊 TraderAgent - Market trading",
    "🏠 RealEstateAgent - Property analysis",
    "📱 MarketerAgent - Content & outreach",
    "🔍 ResearcherAgent - Web research & scraping"
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