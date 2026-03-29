import { CommandRouter } from "../src/core/router.js";
import { SKILLS } from "../src/core/skills.js";

async function testSkills() {
    const router = new CommandRouter();
    
    const testCases = [
        {
            input: "Review this GDPR privacy policy for me",
            expectedSkill: "legal-compliance"
        },
        {
            input: "Can you research our competitors in the real estate space?",
            expectedSkill: "marketing-competitive-analysis"
        },
        {
            input: "Draft a cold email for a prospective buyer",
            expectedSkill: "sales-draft-outreach"
        },
        {
            input: "I need to prepare for a sales call with Apple next week",
            expectedSkill: "sales-call-prep"
        },
        {
            input: "Analyze this dataset for patterns",
            expectedSkill: "data-exploration"
        },
        {
            input: "What are the comps for 82 Halsey St?",
            expectedSkill: "real-estate-comps"
        },
        {
            input: "Write me a YouTube hook for a property walkthrough",
            expectedSkill: "creative-script-writing"
        },
        {
            input: "How can I find the owner of this absentee property?",
            expectedSkill: "skip-tracing-strategy"
        },
        {
            input: "Can you analyze this inspection report for hidden repairs?",
            expectedSkill: "property-analysis"
        }
    ];

    console.log("🚀 Testing Skills Routing (Full Suite)...\n");

    for (const test of testCases) {
        const result = await router.route(test.input);
        const success = result.skillId === test.expectedSkill;
        console.log(`Input: "${test.input}"`);
        console.log(`Result: Agent=${result.agentType}, Skill=${result.skillId || "None"}`);
        console.log(success ? "✅ PASS" : "❌ FAIL");
        console.log("-------------------");
    }
}

testSkills().catch(console.error);
