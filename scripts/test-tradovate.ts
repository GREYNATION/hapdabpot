import { TradovateClient } from '../src/integrations/TradovateClient.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function runTest() {
    console.log("🚀 Initializing Tradovate API Test...");
    console.log("Environment check:");
    console.log(`- TRADOVATE_USERNAME: ${process.env.TRADOVATE_USERNAME ? '✅ Set' : '❌ Missing'}`);
    console.log(`- TRADOVATE_PASSWORD: ${process.env.TRADOVATE_PASSWORD ? '✅ Set' : '❌ Missing'}`);
    console.log(`- TRADOVATE_CID: ${process.env.TRADOVATE_CID ? '✅ Set' : '❌ Missing'}`);
    console.log(`- TRADOVATE_API_SECRET: ${process.env.TRADOVATE_API_SECRET ? '✅ Set' : '❌ Missing'}`);
    
    console.log("\n-----------------------------------\n");

    // Initialize in DEMO mode for safety
    const client = new TradovateClient(false);
    
    console.log("🔄 Step 1: Attempting OAuth Authentication against Demo environment...");
    const success = await client.authenticate();
    
    if (!success) {
        console.error("❌ Authentication failed. Please check your credentials in .env");
        process.exit(1);
    }
    
    console.log("✅ Authentication Succeeded!");
    console.log(`📍 Bound to Account ID: ${client.accountId}`);

    console.log("\n🔄 Step 2: Fetching Account Risk Metrics...");
    const risk = await client.getAccountRisk();
    
    if (risk && risk.length > 0) {
        const item = risk[0];
        console.log("✅ Risk Metrics Retrieved!");
        console.log(`💰 Available Margin: $${item.marginBalance}`);
        console.log(`💰 Realized P&L: $${item.realizedPnL}`);
    } else {
        console.warn("⚠️ Could not retrieve risk metrics.");
    }

    console.log("\n🎉 Tradovate API Bridge is fully operational!");
    console.log("Note: This was a read-only test. No trades were placed.");
    process.exit(0);
}

runTest().catch(console.error);
