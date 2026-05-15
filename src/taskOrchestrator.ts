import { SkillRouter } from "./orchestration/skillRouter.js";
import { createExecutionPlan } from "./orchestration/taskPlanner.js";
import { executePlan } from "./orchestration/dispatcher.js";
import { addPlan } from "./orchestration/state.js";
import { initializeIntentEngine } from "./orchestration/intentEngine.js";

// Initialize the intent engine on startup
initializeIntentEngine().catch(err => console.error("â Œ Intent Engine initialization failed:", err));

export async function processUserInput(userInput: string, userId: string = "default-user") {
  console.log("ðŸ”  Processing user input (Orchestrated):", userInput);
  
  // Step 1: Semantic Intent Matching (via Skill Router)
  console.log("ðŸ§  Routing intent against skill registry...");
  const matchedSkills = await SkillRouter.route(userInput);
  
  if (matchedSkills.length === 0) {
    return {
      success: false,
      response: "ðŸ¤– I couldn't find any specialized skills to handle that request.",
      agent: null
    };
  }
  
  // Step 2: Task Planning
  console.log("ðŸ“‹ Creating execution plan...");
  const plan = await createExecutionPlan(userInput, matchedSkills);
  addPlan(plan);
  
  if (plan.steps.length === 0) {
    return {
      success: false,
      response: "ðŸ¤– I matched your intent but couldn't generate a plan to execute it.",
      agent: null
    };
  }

  // Step 3: Multi-Agent Execution (Dispatch)
  console.log("ðŸš€ Dispatching plan execution...");
  const results = await executePlan(plan);
  
  // Consolidate results for the user
  const finalResponse = Object.values(results || {}).join("\n\n");

  return {
    success: true,
    response: finalResponse || "Plan executed successfully.",
    planId: plan.id,
    steps: plan.steps,
    agent: plan.steps[0]?.skillId, // Primary agent
    userId
  };
}
