// n8nAgent.ts — n8n Automation Engine for Gravity Claw
// Handles live workflows via API and local template management

import fs from "fs";
import path from "path";
import axios from "axios";

const TEMPLATES_DIR = process.env.N8N_TEMPLATES_DIR || "./n8n-templates";
const N8N_API_URL = process.env.N8N_API_URL || "http://localhost:5678/api/v1";
const N8N_API_KEY = process.env.N8N_API_KEY || "";

// In-memo cache to support "preview 1" style commands
let lastTemplateResults: Template[] = [];

// ─── Category Map for Templates ───────────────────────────────────────────────
const CATEGORY_MAP: Record<string, string> = {
  "email":       "Gmail_and_Email_Automation",
  "telegram":    "Telegram",
  "discord":     "Discord",
  "ai":          "AI_Research_RAG_and_Data_Analysis",
  "llm":         "OpenAI_and_LLMs",
  "database":    "Database_and_Storage",
  "notion":      "Notion",
  "sheets":      "Google_Drive_and_Google_Sheets",
  "other":       "Other",
};

// ─── Types ───────────────────────────────────────────────────────────────────
interface Template {
  name: string;
  file: string;
  category: string;
  fullPath: string;
}

// ─── Live Workflow Logic ──────────────────────────────────────────────────────

async function listWorkflows(): Promise<string> {
  if (!N8N_API_KEY) return "⚠️ N8N_API_KEY not set in .env";
  try {
    const res = await axios.get(`${N8N_API_URL}/workflows`, {
      headers: { "X-N8N-API-KEY": N8N_API_KEY }
    });
    const workflows = res.data.data || [];
    if (workflows.length === 0) return "ℹ️ No workflows found on your n8n instance.";

    const lines = workflows.map((w: any) => 
      `🔹 \`${w.id}\` — **${w.name}** [${w.active ? "✅ Active" : "⬜ Inactive"}]`
    );
    return `📟 *Live n8n Workflows*:\n\n${lines.join("\n")}\n\nUse \`/n8n trigger [id]\` to execute.`;
  } catch (err: any) {
    return `❌ Failed to fetch workflows: ${err.response?.data?.message || err.message}`;
  }
}

async function triggerWorkflow(workflowId: string): Promise<string> {
  if (!N8N_API_KEY) return "⚠️ N8N_API_KEY not set in .env";
  try {
    const res = await axios.get(`${N8N_API_URL}/workflows/${workflowId}`, {
      headers: { "X-N8N-API-KEY": N8N_API_KEY }
    });
    const workflow = res.data;
    const nodes = workflow.nodes || [];

    const triggerNode = nodes.find((n: any) => 
      n.type.includes("webhook") || 
      n.type.includes("chatTrigger") || 
      n.type.includes("formTrigger")
    );

    if (!triggerNode) {
      return `⚠️ Workflow "${workflow.name}" has no Webhook or Chat Trigger node. Cannot auto-trigger.`;
    }

    const pathSuffix = triggerNode.parameters?.path || triggerNode.id;
    const baseUrl = N8N_API_URL.replace("/api/v1", "/webhook");
    const triggerUrl = `${baseUrl}/${pathSuffix}`;

    const response = await axios.post(triggerUrl, {
      source: "gravity-claw-bot",
      timestamp: new Date().toISOString()
    });

    return `🚀 *Workflow Triggered!*\n\nID: \`${workflowId}\`\nName: ${workflow.name}\nURL: \`${triggerUrl}\`\nResponse: ${JSON.stringify(response.data).substring(0, 100)}...`;
  } catch (err: any) {
    return `❌ Trigger failed: ${err.response?.data?.message || err.message}`;
  }
}

// ─── Template Logic ──────────────────────────────────────────────────────────

function listTemplates(category?: string): Template[] {
  const results: Template[] = [];
  
  if (fs.existsSync(TEMPLATES_DIR)) {
    const rootFiles = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith(".json"));
    for (const file of rootFiles) {
      results.push({
        name: file.replace(".json", "").replace(/_/g, " "),
        file,
        category: "Root",
        fullPath: path.join(TEMPLATES_DIR, file),
      });
    }
  }

  const dirs = category
    ? [CATEGORY_MAP[category.toLowerCase()]].filter(Boolean)
    : Object.values(CATEGORY_MAP);

  const seen = new Set<string>();
  for (const dir of dirs) {
    if (seen.has(dir)) continue;
    seen.add(dir);
    const fullDir = path.join(TEMPLATES_DIR, dir);
    if (!fs.existsSync(fullDir)) continue;
    const files = fs.readdirSync(fullDir).filter(f => f.endsWith(".json"));
    for (const file of files) {
      results.push({
        name: file.replace(".json", "").replace(/_/g, " "),
        file,
        category: dir,
        fullPath: path.join(fullDir, file),
      });
    }
  }
  return results;
}

function searchTemplates(query: string): Template[] {
  const all = listTemplates();
  const q = query.toLowerCase();
  return all.filter(t =>
    t.name.toLowerCase().includes(q) ||
    t.category.toLowerCase().includes(q)
  );
}

function previewTemplate(filePath: string): string {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const wf = JSON.parse(raw);
      const nodes: string[] = (wf.nodes || []).map((n: any) => n.type?.split(".").pop() || n.name);
      return (
        `📋 *${wf.name || "Unnamed Workflow"}*\n` +
        `📦 Nodes: ${nodes.slice(0, 10).join(" → ")}${nodes.length > 10 ? " ..." : ""}\n` +
        `📊 Total nodes: ${nodes.length}\n` +
        `💡 Use \`/n8n deploy [name]\` to install this.`
      );
    } catch {
      return "⚠️ Could not parse template.";
    }
}

async function deployTemplate(filePath: string): Promise<string> {
  if (!N8N_API_KEY) return "⚠️ N8N_API_KEY not set.";
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const workflow = JSON.parse(raw);
    const res = await axios.post(`${N8N_API_URL}/workflows`, {
      name: workflow.name || "Imported Workflow",
      nodes: workflow.nodes || [],
      connections: workflow.connections || {},
      settings: workflow.settings || {},
    }, {
      headers: { "X-N8N-API-KEY": N8N_API_KEY }
    });
    
    return `✅ Deployed! ID: \`${res.data.id}\` — Open your n8n dashboard to activate.`;
  } catch (err: any) {
    return `❌ Deploy failed: ${err.response?.data?.message || err.message}`;
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export async function handleN8nCommand(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const sub = parts[0]?.toLowerCase();
  const rest = parts.slice(1).join(" ");

  if (!sub || sub === "help") {
    return (
      `🤖 *n8n Automation Manager*\n\n` +
      `*/n8n list* — List all live workflows\n` +
      `*/n8n trigger [id]* — Trigger a workflow via webhook\n` +
      `*/n8n templates* — List local automation templates\n` +
      `*/n8n search [query]* — Search templates by name\n` +
      `*/n8n preview [query/index]* — Preview nodes of a template\n` +
      `*/n8n deploy [query/index]* — Deploy a template to n8n\n`
    );
  }

  // /n8n list
  if (sub === "list") {
    return await listWorkflows();
  }

  // /n8n trigger [id]
  if (sub === "trigger") {
    if (!rest) return "Usage: /n8n trigger [id]";
    return await triggerWorkflow(rest);
  }

  // /n8n templates
  if (sub === "templates") {
    const templates = listTemplates(rest || undefined);
    if (!templates.length) return `⚠️ No templates found.`;
    lastTemplateResults = templates; // Cache results
    const lines = templates.slice(0, 15).map((t, i) => `${i + 1}. [${t.category}] ${t.name}`);
    return `📚 *n8n Templates* (${templates.length}):\n\n` + lines.join("\n") + 
           `\n\n💡 Use \`/n8n preview [number]\` to see details.`;
  }

  // /n8n search [query]
  if (sub === "search") {
    if (!rest) return "Usage: /n8n search [keyword]";
    const results = searchTemplates(rest);
    if (!results.length) return `🔍 No matching templates found for "${rest}"`;
    lastTemplateResults = results; // Cache results
    const lines = results.slice(0, 15).map((t, i) => `${i + 1}. [${t.category}] ${t.name}`);
    return `🔍 *Search Results for "${rest}"*:\n\n` + lines.join("\n") +
           `\n\n💡 Use \`/n8n preview [number]\` to see details.`;
  }

  // /n8n preview [query / index]
  if (sub === "preview") {
      if (!rest) return "Usage: /n8n preview [index or name]";
      
      let t: Template | undefined;
      const index = parseInt(rest);
      if (!isNaN(index) && lastTemplateResults[index - 1]) {
          t = lastTemplateResults[index - 1];
      } else {
          const matches = searchTemplates(rest);
          t = matches[0];
      }

      if (!t) return `⚠️ Could not find template. Run \`/n8n search\` or \`/n8n templates\` first to see available numbers.`;
      return previewTemplate(t.fullPath);
  }

  // /n8n deploy [query / index]
  if (sub === "deploy") {
    if (!rest) return "Usage: /n8n deploy [index or name]";
    
    let t: Template | undefined;
    const index = parseInt(rest);
    if (!isNaN(index) && lastTemplateResults[index - 1]) {
        t = lastTemplateResults[index - 1];
    } else {
        const matches = searchTemplates(rest);
        t = matches[0];
    }

    if (!t) return `⚠️ Could not find template matching "${rest}".`;
    const result = await deployTemplate(t.fullPath);
    return `⚙️ *Deploying: ${t.name}*\n${result}`;
  }

  return `❓ Unknown command: ${sub}. Try \`/n8n help\``;
}
