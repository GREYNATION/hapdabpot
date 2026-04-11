import { askAI, buildTool, AITool } from "../../core/ai.js";
import { tools } from "../../core/tools/index.js";

async function runTask({ input, tools: jsTools, autonomous }: { input: string, tools: any, autonomous: boolean }) {
    console.log(`[runTask] Autonomous Mode: ${autonomous}. Initiating node-native workflow...`);
    
    // Auto-generate OpenAI JSON schema for the tools
    const aiTools: AITool[] = [
        buildTool("findDeals", "Find real estate deals by city", { city: { type: "string", description: "City to search" } }, ["city"]),
        buildTool("findAuctionDeals", "Find foreclosure auctions by city", { city: { type: "string", description: "City to search" } }, ["city"]),
        buildTool("calculateMaxOffer", "Calculate Maximum Allowed Offer", { arv: { type: "number", description: "ARV" }, repairs: { type: "number", description: "Repairs" } }, ["arv", "repairs"]),
        buildTool("calculateSurplus", "Calculate estimated overage/surplus on an auction property", { salePrice: { type: "number", description: "Estimated or Final Sale Price" }, debt: { type: "number", description: "Minimum Bid or Total Debt Owed" } }, ["salePrice", "debt"]),
        buildTool("skipTrace", "Find a property owner's phone number using skip tracing", { name: { type: "string", description: "Owner's Full Name" }, city: { type: "string", description: "City" } }, ["name", "city"]),
        buildTool("sendTelegram", "Send a direct notification message via Telegram to the bot owner", { message: { type: "string", description: "The message content to send" } }, ["message"]),
        buildTool("sendSurplusAlert", "Send a strongly formatted Telegram Surplus Alert notification to the owner about a high margin auction deal.", { 
             address: { type: "string", description: "Deal Address" }, 
             surplus: { type: "number", description: "Calculated Surplus value" }, 
             debt: { type: "number", description: "Debt/Bid amount" }, 
             owner: { type: "string", description: "Owner Name" },
             phone: { type: "string", description: "Skip Traced Phone Number" }
        }, ["address", "surplus", "debt", "owner", "phone"]),
        buildTool("saveDeal", "Save a deal to the database", { 
             address: { type: "string", description: "Address" }, 
             phone: { type: "string", description: "Phone" }, 
             arv: { type: "number", description: "ARV" }, 
             price: { type: "number", description: "Price" },
             seller: { type: "string", description: "Seller Name" },
             status: { type: "string", description: "Set to 'surplus_opportunity' if surplus > 10000" },
             notes: { type: "string", description: "Notes about the deal or calculated surplus" }
        }, ["address"]),
        buildTool("sendSMS", "Send an SMS message to a seller", { phone: { type: "string", description: "Phone number" }, message: { type: "string", description: "Message content" } }, ["phone", "message"]),
        buildTool("runSurplusAgent", "Executes the full automated surplus pipeline for a target city (scrapes auctions, math, skip traces, and notifies). Use this to handle the entire surplus workflow seamlessly in one step.", { city: { type: "string", description: "Target City" } }, ["city"]),
        buildTool("triggerAICall", "Initiates an outbound AI Voice Agent call (e.g. Twilio) to an owner regarding a specific deal context.", { 
            deal: { 
                type: "object", 
                description: "The Deal object containing { address, surplus, debt, owner, phone } bindings." 
            } 
        }, ["deal"]),
        buildTool("generateContract", "Generates a legal Assignment Agreement for a surplus deal based on the deal terms and owner info.", {
            deal: {
                type: "object",
                description: "The Deal object containing { address, owner, phone } bindings."
            }
        }, ["deal"]),
        buildTool("alertBuyers", "Automatically matches high-quality deals with corporate buyers and sends them SMS alerts based on their budget and city.", {
            dealId: {
                type: "number",
                description: "The internal ID of the deal to alert buyers about."
            }
        }, ["dealId"])
    ];

    let messages: any[] = [{ role: "user", content: input }];

    const maxLoops = autonomous ? 7 : 1;
    
    for (let i = 0; i < maxLoops; i++) {
        console.log(`[runTask] Iteration ${i+1}/${maxLoops}`);
        const response = await askAI("", "You are Claw, the Autonomous Real Estate Agent. Use your tools to fulfill the user's intent.", {
            messages,
            tools: aiTools,
            toolChoice: "auto"
        });

        const calls = response.tool_calls || response.toolCalls;
        if (calls && calls.length > 0) {
            messages.push({ role: "assistant", content: response.content || `Running ${calls.length} tools...`, tool_calls: calls });

            for (const call of calls) {
                const funcName = call.function.name;
                const args = JSON.parse(call.function.arguments);
                console.log(`[Claw Agent Exec] 🛠️ ${funcName}(...)`);

                let resStr = "";
                if (jsTools[funcName]) {
                   try {
                       const res = await jsTools[funcName](args);
                       resStr = JSON.stringify(res || "Success");
                   } catch(e: any) {
                       resStr = `Error: ${e.message}`;
                   }
                } else {
                   resStr = "Function not found in schema";
                }

                messages.push({
                   role: "tool",
                   tool_call_id: call.id,
                   content: resStr
                });
            }
        } else {
            return response.content;
        }
    }
    
    return "Timeout: Reached max autonomous iterations.";
}

export async function runClawAgent(goal: string) {
  return await runTask({
    input: goal,
    tools: tools,
    autonomous: true
  });
}
