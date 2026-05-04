import { CouncilOrchestrator } from "./core/orchestrator/councilOrchestrator.js";
import { isDramaCommand } from "./agents/drama/DramaAgent.js";
import "dotenv/config";

async function testRouting() {
    const orchestrator = new CouncilOrchestrator();
    const testMessages = [
        "Write episode 5 of gilded claws",
        "/drama_status",
        "What is the current status of gilded claws production?",
        "This is a normal message about trading"
    ];

    console.log("🚀 Testing Drama Routing...\n");

    for (const msg of testMessages) {
        console.log(`Checking: "${msg}"`);
        const isDrama = isDramaCommand(msg);
        console.log(`  Is Drama: ${isDrama}`);

        if (isDrama) {
            console.log(`  Routing via CouncilOrchestrator...`);
            try {
                // Mock chatId
                const response = await orchestrator.chat(msg, 123456);
                console.log(`  Response received (first 100 chars): ${response.substring(0, 100)}...`);
            } catch (err: any) {
                console.error(`  ❌ Routing Error: ${err.message}`);
            }
        }
        console.log("-" .repeat(40));
    }
}

testRouting().catch(console.error);
