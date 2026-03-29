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
        return "âŒ Please provide a URL to scrape. Usage: /scrape [url]";
      }
      const data = await PropertyScraper.scrapeListings(url);
      if (data.length === 0) {
        return "âŒ No listings found. Check the URL or CSS selectors.";
      }
      return data.map((p, i) => `${i + 1}. ${p.title}\n   ðŸ’° ${p.price}\n   ðŸ“ ${p.address}\n   ðŸ”— ${p.link}`).join("\n\n");

    case "agents":
      return listAgents();

    default:
      return "âŒ Unknown command. Available: /build, /scrape, /agents";
  }
}

function listAgents() {
  return [
    "ðŸ“ DeveloperAgent - Software development",
    "ðŸ“Š TraderAgent - Market trading",
    "ðŸ  RealEstateAgent - Property analysis",
    "ðŸ“± MarketerAgent - Content & outreach",
    "ðŸ” ResearcherAgent - Web research & scraping"
  ].join("\n");
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log("ðŸ¤– Gravity Claw CLI Bot");
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
