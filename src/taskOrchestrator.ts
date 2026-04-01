import { aiRoute } from "./agents/aiRouter.js";
import { TraderAgent } from "./agents/TraderAgent.js";
import { ContentAgent } from "./agents/ContentAgent.js";

const agents = {
  TraderAgent: new TraderAgent(),
  ContentAgent: new ContentAgent()
};

export async function processUserInput(userInput: string, userId: string = "default-user") {
  console.log("ðŸ” Processing user input:", userInput);
  
  // Step 1: AI Router decides which agent to use
  console.log("ðŸ§  AI Router analyzing request...");
  const agentName = await aiRoute(userInput);
  
  if (!agentName || !agents[agentName as keyof typeof agents]) {
    return {
      success: false,
      response: "ðŸ¤– AI could not determine the best agent for your request.",
      agent: null
    };
  }
  
  // Step 2: Best Agent Selected
  const selectedAgent = agents[agentName as keyof typeof agents];
  console.log(`âœ… Selected agent: ${agentName}`);
  
  // Step 3-6: Agent handles the task (includes vector memory search and storage)
  console.log("ðŸ“Š Agent executing with vector memory search...");
  const result = await selectedAgent.execute(userInput, userId);
  
  return {
    success: true,
    response: result,
    agent: agentName,
    userId
  };
}

// Example usage:
// const result = await processUserInput("Analyze forex trends", "user-123");
// console.log(result.response);
