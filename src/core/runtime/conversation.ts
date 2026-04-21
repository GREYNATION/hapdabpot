import { askAI, AITool } from "../ai.js";
import { Session, Message } from "./session.js";
import { PermissionEnforcer, PermissionPolicy } from "./permission.js";

export interface RuntimeOptions {
  session: Session;
  enforcer: PermissionEnforcer;
  tools: Record<string, Function>;
  aiTools: AITool[];
  maxLoops?: number;
  systemPrompt?: string;
}

export class ConversationRuntime {
  private session: Session;
  private enforcer: PermissionEnforcer;
  private tools: Record<string, Function>;
  private aiTools: AITool[];
  private maxLoops: number;
  private systemPrompt: string;

  constructor(options: RuntimeOptions) {
    this.session = options.session;
    this.enforcer = options.enforcer;
    this.tools = options.tools;
    this.aiTools = options.aiTools;
    this.maxLoops = options.maxLoops || 7;
    this.systemPrompt = options.systemPrompt || "You are a high-performance autonomous agent.";
  }

  /**
   * Executes a single turn of the conversation.
   * If the user provides an input, it's added to the session first.
   */
  public async run(userInput?: string): Promise<string> {
    if (userInput) {
      this.session.addMessage({ role: "user", content: userInput });
    }

    for (let i = 0; i < this.maxLoops; i++) {
        console.log(`[Runtime] Loop ${i + 1}/${this.maxLoops}`);
        
        const response = await askAI("", this.systemPrompt, {
            messages: this.session.getMessages() as any,
            tools: this.aiTools,
            toolChoice: "auto"
        });

        const toolCalls = response.tool_calls || response.toolCalls;
        
        if (toolCalls && toolCalls.length > 0) {
            // Add assistant message with tool calls to session
            this.session.addMessage({ 
                role: "assistant", 
                content: response.content || "Processing...", 
                tool_calls: toolCalls 
            });

            for (const call of toolCalls) {
                const name = call.function.name;
                const args = JSON.parse(call.function.arguments);

                // Check Permissions
                const policy = await this.enforcer.checkPermission(name, args);
                
                if (policy === PermissionPolicy.Denied) {
                    this.session.addMessage({
                        role: "tool",
                        tool_call_id: call.id,
                        name: name,
                        content: "Error: Permission Denied for this operation."
                    });
                    continue;
                }

                // Execute Tool
                let result = "";
                if (this.tools[name]) {
                    try {
                        const toolRes = await this.tools[name](args);
                        result = JSON.stringify(toolRes ?? "Success");
                    } catch (e: any) {
                        result = `Error: ${e.message}`;
                    }
                } else {
                    result = `Error: Tool ${name} not found.`;
                }

                this.session.addMessage({
                    role: "tool",
                    tool_call_id: call.id,
                    name: name,
                    content: result
                });
            }
        } else {
            // Terminal message (no tool calls)
            this.session.addMessage({ role: "assistant", content: response.content });
            return response.content;
        }
    }

    return "Max loops reached without terminal response.";
  }
}
