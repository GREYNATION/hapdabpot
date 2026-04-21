import "./core/init.js";
import "dotenv/config";
import { initializeConfig, config, log } from "./core/config.js";
import { buildTool } from "./core/ai.js";
import { tools as jsTools } from "./core/tools/index.js";
import { Session } from "./core/runtime/session.js";
import { PermissionEnforcer } from "./core/runtime/permission.js";
import { ConversationRuntime } from "./core/runtime/conversation.js";
import { PropertyScraper } from "./services/PropertyScraper.js";

async function bootstrap() {
    await initializeConfig();
    log("🤖 Hapda Bot Engine (Claw Architecture) Initialized.");
}

async function handleHapdaCommand(input: string, userId: string = "default-user") {
    if (!input.startsWith("/")) return;

    const [command, ...args] = input.slice(1).split(" ");
    const userInput = args.join(" ");

    switch (command) {
        case "auto":
        case "goal":
            try {
                const session = new Session(`
You are Hapda Bot, running on the high-performance 'Claw Architecture'.
Your mission is to autonomously identify and capture real estate opportunities.
You have full access to tools for scraping, financial analysis, skip tracing, and outreach.
Sound like a trustworthy, short-sentenced human assistant.
`);
                const enforcer = new PermissionEnforcer();
                const aiTools = [
                    buildTool("findDeals", "Find real estate deals by city", { city: { type: "string", description: "City to search" } }, ["city"]),
                    buildTool("findAuctionDeals", "Find foreclosure auctions by city", { city: { type: "string", description: "City to search" } }, ["city"]),
                    buildTool("calculateMaxOffer", "Calculate Maximum Allowed Offer", { arv: { type: "number", description: "ARV" }, repairs: { type: "number", description: "Repairs" } }, ["arv", "repairs"]),
                    buildTool("calculateSurplus", "Calculate estimated overage/surplus on an auction property", { salePrice: { type: "number", description: "Estimated or Final Sale Price" }, debt: { type: "number", description: "Minimum Bid or Total Debt Owed" } }, ["salePrice", "debt"]),
                    buildTool("skipTrace", "Find a property owner's phone number using skip tracing", { name: { type: "string", description: "Owner's Full Name" }, city: { type: "string", description: "City" } }, ["name", "city"]),
                    buildTool("sendTelegram", "Send a direct notification message via Telegram to the bot owner", { message: { type: "string", description: "The message content to send" } }, ["message"]),
                    buildTool("saveDeal", "Save a deal to the database", { address: { type: "string" } }, ["address"]),
                    buildTool("sendSMS", "Send an SMS message to a seller", { phone: { type: "string" }, message: { type: "string" } }, ["phone", "message"]),
                    buildTool("runSurplusAgent", "Executes the full automated surplus pipeline for a target city", { city: { type: "string" } }, ["city"]),
                    buildTool("triggerAICall", "Initiates an outbound AI Voice Agent call", { deal: { type: "object" } }, ["deal"]),
                ];

                const runtime = new ConversationRuntime({
                    session,
                    enforcer,
                    tools: jsTools,
                    aiTools,
                    maxLoops: 10,
                    systemPrompt: "Execute the autonomous goal with high precision."
                });

                log(`[Hapda Bot] 🚀 Starting autonomous goal: ${userInput}`);
                const result = await runtime.run(userInput);
                
                return `🤖 **Hapda (Claw) Result**\n\n${result}`;
            } catch (err: any) {
                return `❌ Hapda Error: ${err.message}`;
            }

        case "scrape":
            const url = args[0];
            if (!url) return "❌ Usage: /scrape [url]";
            const data = await PropertyScraper.scrapeListings(url);
            return `Scraped ${data.length} listings. Check logs for details.`;

        case "status":
            return `🤖 Hapda Bot is ONLINE. Running on ${config.aiProvider} with ${config.openaiModel}.`;

        default:
            return "🤖 Hapda Bot: Use /auto [goal] to start an autonomous task.";
    }
}

async function main() {
    await bootstrap();
    
    const args = process.argv.slice(2);
    if (args.length === 0) {
        log("Usage: tsx src/hapda_bot.ts -- /auto 'my goal'");
        return;
    }

    let input = args.join(" ");
    if (!input.startsWith("/")) input = "/" + input;

    const output = await handleHapdaCommand(input);
    console.log("\n" + output);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("hapda_bot.ts")) {
    main();
}

export { handleHapdaCommand };
