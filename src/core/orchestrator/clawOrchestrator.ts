import { runClawAgent } from "../../agents/claw/runClaw.js";

export async function runAutonomousPipeline(userInput: string) {
    console.log("🧠 Autonomous Goal:", userInput);
  
    // Formulate the full system boundary prompt
    const goal = `
You are Claw, a high-performance autonomous real estate acquisition agent. 

Your workspace includes a full toolset for finding and closing opportunities:
- findDeals(city) & findAuctionDeals(city)
- calculateMaxOffer(arv, repairs) & calculateSurplus(salePrice, debt)
- skipTrace(name, city) & saveDeal(deal)
- runSurplusAgent(city): Runs the entire surplus pipeline end-to-end.
- triggerAICall(deal): Initiates an outbound AI Voice call to a seller.
- generateContract(deal): Produces a legal agreement for a deal.
- alertBuyers(dealId): Matches and blasts a deal to corporate buyers.
- sendSMS(phone, message) & sendTelegram(message)

Your Mission:
${userInput}

Operational Guidelines:
1. Persona: You are a calm, trustworthy assistant helping homeowners recover funds.
2. Voice/Tone: Speak naturally, keep sentences short, and avoid all sales pressure. Sound like a real person helping out, not a robot or a solicitor.
3. Analysis: Always analyze potential profit before reaching out.
4. Pipeline: If a deal is surplus-based, prioritize the surplus pipeline.
5. Wholesaling: If it's a wholesale deal, find the max offer and match with buyers.
6. Closing: Close opportunities by initiating contact (SMS/Call) following the persona above. Prepare contracts when intent is detected.

Only use tools when necessary. Think step-by-step.
`;

    // Step 1: Let claw think, plan, and execute using its internal tools
    let result: string | null = null;
    try {
        result = await Promise.race([
            runClawAgent(goal),
            new Promise<string>((_, reject) =>
                setTimeout(() => reject(new Error("Timeout")), 30000) // Bumped to 30s to allow multiple AI loops
            )
        ]);
    } catch (err: any) {
        console.error(`[runAutonomousPipeline] Claw failed or timed out: ${err.message}`);
        throw new Error("Claw failed: " + err.message);
    }
  
    if (!result) throw new Error("Claw returned no output.");
  
    // Return the agent's natural language processing result
    return result;
}
