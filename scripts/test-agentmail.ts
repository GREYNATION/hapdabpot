import { agentMail } from '../src/services/agentmail.js';
import { log } from '../src/core/config.js';

async function testAgentMail() {
    console.log("📬 Testing AgentMail Integration...");
    
    try {
        // 1. Test Listing (should work even if empty)
        console.log("\n1. Listing recent emails...");
        const emails = await agentMail.listMessages(5);
        console.log(`Found ${emails.length} emails.`);
        emails.forEach(e => console.log(`- [${e.timestamp}] From: ${e.from}, Subject: ${e.subject}`));

        // 2. Test Sending (to self or test address)
        console.log("\n2. Sending test email...");
        const recipient = "hapdabot@agentmail.to"; // Sending to self for test
        const result = await agentMail.sendEmail(
            recipient, 
            "Test from Gravity Claw", 
            "This is a test email from the newly integrated AgentMail service in Gravity Claw bot."
        );
        console.log("Email sent successfully!", result);

    } catch (e: any) {
        console.error("❌ Test failed:", e.message);
        if (e.response) {
            console.error("Response data:", e.response.data);
        }
    }
}

testAgentMail();
