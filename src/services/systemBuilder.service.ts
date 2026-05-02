import { getSupabase } from "../core/supabase.js";
import { log } from "../core/config.js";
import PDFDocument from "pdfkit";
import { Readable } from "stream";
import type { ParsedClientIntake, AgentType } from "../agents/SystemBuilderAgent.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VapiAssistantConfig {
  name: string;
  role: AgentType;
  firstMessage: string;
  systemPrompt: string;
  voiceId: string;         // swap in real Vapi voice ID when ready
  model: string;
  tools: string[];
}

export interface SystemConfig {
  clientId?: string;
  agents: VapiAssistantConfig[];
  chatbotConfig: ChatbotConfig;
  schedulingConfig: SchedulingConfig;
  leadSources: string[];
  vapiReadyJSON: object;   // drop-in JSON for Vapi dashboard
}

interface ChatbotConfig {
  platform: "Chatwoot";    // free open source
  channels: string[];
  welcomeMessage: string;
}

interface SchedulingConfig {
  platform: "Cal.com";     // free open source
  eventTypes: string[];
}

// ─── Voice IDs (scaffold — swap real Vapi IDs later) ─────────────────────────

const VOICE_MAP: Record<AgentType, string> = {
  CSR:        "VAPI_VOICE_FEMALE_PROFESSIONAL",  // replace with real ID
  ASSISTANT:  "VAPI_VOICE_FEMALE_FRIENDLY",
  OFFICE_MGR: "VAPI_VOICE_MALE_PROFESSIONAL",
  SALES_REP:  "VAPI_VOICE_MALE_ENERGETIC",
};

// ─── Agent system prompts ────────────────────────────────────────────────────

function buildAgentPrompt(
  role: AgentType,
  industry: string,
  businessName: string,
  location: string
): string {
  const base = `You are an AI assistant for ${businessName}, a ${industry} company in ${location}.`;

  const rolePrompts: Record<AgentType, string> = {
    CSR: `${base}
Your job is to answer inbound calls professionally, capture caller information, answer common questions about services, and book appointments.
- Always greet warmly and get the caller's name within the first exchange
- Qualify: Are they a current customer or new lead?
- Offer to book an appointment or transfer to a specialist
- If after hours, take a message and promise a callback next business day
- Never make up pricing — say "I'll have someone confirm that with you"`,

    ASSISTANT: `${base}
You handle all text-based communication: SMS, email, Facebook, Instagram, and web chat.
- Respond within seconds to new messages
- Qualify leads: location, service needed, timeline, budget range
- Book appointments directly via Cal.com when ready
- Send confirmation messages after booking
- Escalate urgent issues to the human team`,

    OFFICE_MGR: `${base}
You make outbound calls to existing customers to schedule routine service, maintenance visits, or follow-ups.
- Call tone: friendly, familiar — they're existing customers
- Purpose: schedule their next service or check-in on satisfaction
- Always offer 2-3 time slots
- Log the outcome in CRM after every call`,

    SALES_REP: `${base}
You make outbound calls to new leads who have expressed interest in services.
- Open with energy — you're following up on their inquiry
- Qualify: specific need, timeline, budget, decision-maker?
- Goal: book a site visit or consultation
- Handle objections with empathy, not pressure
- If not ready: ask permission to follow up in 2 weeks`,
  };

  return rolePrompts[role];
}

// ─── Main Service Class ──────────────────────────────────────────────────────

export class SystemBuilderService {
    private supabase = getSupabase();

    private get db() {
        if (!this.supabase) throw new Error("Supabase client not initialized");
        return this.supabase;
    }

    /**
     * Generates a professional PDF proposal for a client system
     */
    async generateProposalPDF(clientId: string): Promise<Buffer> {
        log(`[SystemBuilderService] Generating PDF proposal for Client ID: ${clientId}`);
        
        const { data: client, error } = await this.db
            .from("client_systems")
            .select("*")
            .eq("id", clientId)
            .single();

        if (error || !client) {
            throw new Error(`Client system not found: ${error?.message || "Invalid ID"}`);
        }

        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ margin: 50 });
            const chunks: Buffer[] = [];

            doc.on("data", (chunk) => chunks.push(chunk));
            doc.on("end", () => resolve(Buffer.concat(chunks)));
            doc.on("error", (err) => reject(err));

            // Header
            doc.fontSize(24).fillColor("#00d4ff").text("HADES AUTOMATION PROPOSAL", { align: "center" });
            doc.moveDown();
            doc.fontSize(12).fillColor("#444").text(`Prepared for: ${client.business_name}`, { align: "center" });
            doc.text(`Location: ${client.location || "N/A"}`, { align: "center" });
            doc.text(`Date: ${new Date().toLocaleDateString()}`, { align: "center" });
            doc.moveDown(2);

            // Title
            doc.fontSize(18).fillColor("#000").text("Executive Summary", { underline: true });
            doc.moveDown();
            doc.fontSize(11).fillColor("#333").text(client.roi_pitch || "Autonomous AI orchestration for streamlined business operations.");
            doc.moveDown(2);

            // System Architecture
            doc.fontSize(18).text("Open-Stack AI Architecture", { underline: true });
            doc.moveDown();
            doc.fontSize(10).text("The following agents will be provisioned using our proprietary 'Claw' neural framework:");
            doc.moveDown();

            if (client.agents) {
                client.agents.forEach((role: string) => {
                    doc.fontSize(12).fillColor("#00d4ff").text(`${role.toUpperCase()} AGENT`);
                    doc.fontSize(10).fillColor("#333").text(`Status: Provisioned for ${client.business_name}`);
                    doc.moveDown(0.5);
                });
            }

            doc.moveDown();
            doc.fontSize(18).text("Infrastructure & ROI", { underline: true });
            doc.moveDown();
            doc.fontSize(10).text("• Voice Layer: Vapi.ai (Real-time neural voice)");
            doc.text("• CRM Layer: Chatwoot (Omnichannel orchestration)");
            doc.text("• Scheduling Layer: Cal.com (Autonomous booking)");
            doc.moveDown();
            doc.text(`Estimated Monthly ROI: ${client.roi_pitch ? "High-Impact" : "3.5x - 5.0x"}`);

            doc.moveDown(2);
            doc.fontSize(8).fillColor("#999").text("Generated by HADES Funnel Architecture | Nonstop Automation", { align: "center" });

            doc.end();
        });
    }

    async createClientSystem(insertData: any) {
        const { data, error } = await this.db
            .from("client_systems")
            .insert(insertData)
            .select("id")
            .single();

        if (error) {
            console.error("[saveClientSystem] Supabase error:", error);
            throw error;
        }

        return data;
    }
}

export const systemBuilderService = new SystemBuilderService();

// ─── Top-level exports for Agent integration ────────────────────────────────

export function generateSystemConfig(
  intake: ParsedClientIntake & {
    csr_script_opening: string;
    sales_rep_script_opening: string;
    recommended_tools: string[];
    roi_pitch: string;
  }
): SystemConfig {
  const { businessName, industry, location, agents, leadSources } = intake;

  // Build Vapi assistant configs for each selected agent
  const vapiAgents: VapiAssistantConfig[] = agents.map((role) => ({
    name: `${businessName} — ${role.replace("_", " ")}`,
    role,
    firstMessage:
      role === "CSR"
        ? intake.csr_script_opening
        : role === "SALES_REP"
        ? intake.sales_rep_script_opening
        : role === "OFFICE_MGR"
        ? `Hi, this is the ${businessName} scheduling team calling. Am I speaking with [customer name]?`
        : "",
    systemPrompt: buildAgentPrompt(role, industry, businessName, location),
    voiceId: VOICE_MAP[role],
    model: "claude-3-5-sonnet-20241022",
    tools: getAgentTools(role),
  }));

  // Chatbot config (Chatwoot — free, open source)
  const chatbotConfig: ChatbotConfig = {
    platform: "Chatwoot",
    channels: ["email", "sms", "facebook", "instagram", "web_chat"],
    welcomeMessage: `Hi! Thanks for reaching out to ${businessName}. How can we help you today?`,
  };

  // Scheduling config (Cal.com — free, open source)
  const schedulingConfig: SchedulingConfig = {
    platform: "Cal.com",
    eventTypes: getEventTypes(industry),
  };

  // Drop-in Vapi JSON (scaffold — paste into Vapi dashboard)
  const vapiReadyJSON = {
    assistants: vapiAgents.map((a) => ({
      name: a.name,
      model: {
        provider: "anthropic",
        model: "claude-3-5-sonnet-20241022",
        systemPrompt: a.systemPrompt,
      },
      voice: {
        provider: "11labs",
        voiceId: a.voiceId,
      },
      firstMessage: a.firstMessage,
      transcriber: { provider: "deepgram", model: "nova-2" },
    })),
  };

  return {
    agents: vapiAgents,
    chatbotConfig,
    schedulingConfig,
    leadSources,
    vapiReadyJSON,
  };
}

function getAgentTools(role: AgentType): string[] {
  const toolMap: Record<AgentType, string[]> = {
    CSR:        ["calendar_booking", "crm_lookup", "sms_followup", "call_transfer"],
    ASSISTANT:  ["calendar_booking", "crm_create_lead", "send_email", "send_sms"],
    OFFICE_MGR: ["crm_lookup", "calendar_booking", "call_log"],
    SALES_REP:  ["crm_create_lead", "calendar_booking", "call_log", "send_followup_sms"],
  };
  return toolMap[role];
}

function getEventTypes(industry: string): string[] {
  const base = ["Free Consultation", "Site Visit", "Follow-Up Call"];
  const industryExtras: Record<string, string[]> = {
    roofing:       ["Roof Inspection", "Estimate Appointment"],
    hvac:          ["AC Tune-Up", "Emergency Service", "Maintenance Visit"],
    "real estate": ["Property Walkthrough", "Offer Review Call"],
    dental:        ["New Patient Exam", "Cleaning Appointment"],
    "med spa":     ["Consultation", "Treatment Appointment"],
    plumbing:      ["Emergency Call", "Estimate Visit"],
    solar:         ["Energy Assessment", "Installation Consult"],
  };
  const key = Object.keys(industryExtras).find((k) =>
    industry.toLowerCase().includes(k)
  );
  return [...base, ...(key ? industryExtras[key] : [])];
}

export async function saveClientSystem({
  intake,
  systemConfig,
  createdBy,
}: {
  intake: ParsedClientIntake & { roi_pitch: string; recommended_tools: string[] };
  systemConfig: SystemConfig;
  createdBy: number;
}): Promise<string> {
  const data = await systemBuilderService.createClientSystem({
      business_name:    intake.businessName,
      industry:         intake.industry,
      location:         intake.location,
      tier:             intake.tier,
      agents:           intake.agents,
      lead_sources:     intake.leadSources,
      monthly_price:    intake.monthlyPrice,
      setup_fee:        intake.setupFee,
      roi_pitch:        intake.roi_pitch,
      recommended_tools: intake.recommended_tools,
      system_config:    systemConfig,
      vapi_json:        systemConfig.vapiReadyJSON,
      status:           "configured",
      created_by:       createdBy,
      created_at:       new Date().toISOString(),
  });

  return data?.id || "unknown";
}

export function formatTelegramSummary(
  intake: ParsedClientIntake & { roi_pitch: string; recommended_tools: string[] },
  systemConfig: SystemConfig,
  clientId: string
): string {
  const agentLines = systemConfig.agents
    .map((a) => {
      const icons: Record<AgentType, string> = {
        CSR:        "📞",
        ASSISTANT:  "💬",
        OFFICE_MGR: "🏢",
        SALES_REP:  "💰",
      };
      return `${icons[a.role]} *${a.role.replace("_", " ")}* — ${a.firstMessage.substring(0, 60)}...`;
    })
    .join("\n");

  const toolLines = intake.recommended_tools.slice(0, 4).join(" · ");

  return `⚡ *SYSTEM BUILT — ${intake.businessName.toUpperCase()}*

🏭 *Industry:* ${intake.industry}
📍 *Location:* ${intake.location}
🎯 *Tier:* ${intake.tier}
💵 *Monthly:* $${intake.monthlyPrice}/mo
🔧 *Setup Fee:* $${intake.setupFee} (one-time)

*─── AI AGENTS ───*
${agentLines}

*─── LEAD SOURCES ───*
${intake.leadSources.slice(0, 6).join(" · ")}

*─── FREE STACK ───*
${toolLines}

*─── ROI PITCH ───*
_${intake.roi_pitch}_

*─── NEXT STEPS ───*
1️⃣ Share proposal with client
2️⃣ Collect setup fee → deploy Vapi assistants
3️⃣ Connect Chatwoot for chat channels
4️⃣ Set up Cal.com event types
5️⃣ Go live 🚀

🗂 *Client ID:* \`${clientId}\`
Use /proposal ${clientId} to pull full config`;
}
