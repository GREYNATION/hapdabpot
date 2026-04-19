import { askAI } from './src/core/ai.js';
import { initializeConfig } from './src/core/config.js';

async function verify() {
    console.log("--- Starting Sanitization Verification ---");
    
    // We don't even need initializeConfig if askAI is hardened
    try {
        console.log("Requesting restricted model: llama-3.3-70b-versatile...");
        const response = await askAI("Say 'Sanitization Active'", "You are a tester.", {
            model: "llama-3.3-70b-versatile"
        });
        
        console.log("\n[SUCCESS] AI responded without 400 error.");
        console.log("Actual model used by provider:", response.model);
        console.log("AI Content:", response.content);
        
        if (response.model === "llama-3.1-70b-versatile") {
            console.log("\n✅ VERIFIED: llama-3.3 was successfully diverted to llama-3.1.");
        } else {
            console.log("\n⚠️ WARNING: Response received but model diversion was not detected as llama-3.1.");
        }
    } catch (err: any) {
        console.error("\n❌ FAILED: Still getting error:", err.message);
    }
}

verify();
