import { agentMail } from "../services/agentmail.js";
import { askAI } from "../core/ai.js";
import { config } from "../core/config.js";

/**
 * Agent for managing email operations.
 */
export async function emailAgent(task: string) {
    const systemPrompt = `
You are an Email Assistant. You have access to the 'agentMail' service.
Your goal is to parse the user's request and determine if they want to LIST, READ, or SEND an email.

Return a JSON object ONLY.

FORMAT:
{
  "action": "list" | "read" | "send",
  "data": { ... }
}

ACTION RULES:
- "list": No extra data needed.
- "read": Requires "messageId" in data.
- "send": Requires "to", "subject", and "body" in data.

USER TASK: ${task}
`;

    const response = await askAI(task, systemPrompt, {
        jsonMode: true,
        model: config.openaiModel
    });

    try {
        const intent = JSON.parse(response.content);
        
        if (intent.action === "list") {
            const emails = await agentMail.listMessages();
            return `📬 **Recent Emails:**\n\n${emails.map((e: any) => `🆔 \`${e.id}\` | From: ${e.from} | Subject: ${e.subject}`).join("\n")}`;
        }

        if (intent.action === "read") {
            const email = await agentMail.getMessage(intent.data.messageId);
            return `📧 **Email Content:**\n\n**From:** ${email.from}\n**Subject:** ${email.subject}\n\n${email.body}`;
        }

        if (intent.action === "send") {
            const result = await agentMail.sendEmail(intent.data.to, intent.data.subject, intent.data.body);
            return `✅ **Email Sent!**\n\n**To:** ${intent.data.to}\n**Subject:** ${intent.data.subject}\n\n${result.message || ""}`;
        }

        return "❌ Unsupported email action.";
    } catch (err) {
        return "❌ Failed to process email task.";
    }
}
