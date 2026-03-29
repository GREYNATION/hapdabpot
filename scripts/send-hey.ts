import { agentMail } from '../src/services/agentmail.js';
import { log } from '../src/core/config.js';

async function sendHey() {
    console.log("📬 Sending 'hey' to hapdabot@agentmail.to...");
    
    try {
        const result = await agentMail.sendEmail(
            "hapdabot@agentmail.to", 
            "hey", 
            "hey to make sure"
        );
        console.log("Email sent successfully!", result);
    } catch (e: any) {
        console.error("❌ Send failed:", e.message);
    }
}

sendHey();
