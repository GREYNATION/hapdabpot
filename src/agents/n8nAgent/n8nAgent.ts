// n8nAgent.ts — Drop into hapdabot/src/agents/n8nAgent/
// Handles /n8n command: browse, preview, and deploy templates from awesome-n8n-templates

import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const TEMPLATES_DIR = process.env.N8N_TEMPLATES_DIR || "./n8n-templates";
const N8N_API_URL = process.env.N8N_API_URL || "http://localhost:5678/api/v1";
const N8N_API_KEY = process.env.N8N_API_KEY || "";

// ─── Category Map ────────────────────────────────────────────────────────────
const CATEGORY_MAP: Record<string, string> = {
  "email":       "Gmail_and_Email_Automation",
  "telegram":    "Telegram",
  "discord":     "Discord",
  "whatsapp":    "WhatsApp",
  "slack":       "Slack",
  "notion":      "Notion",
  "airtable":    "Airtable",
  "drive":       "Google_Drive_and_Google_Sheets",
  "sheets":      "Google_Drive_and_Google_Sheets",
  "wordpress":   "WordPress",
  "pdf":         "PDF_and_Document_Processing",
  "social":      "Social_Media",
  "ai":          "AI_Research_RAG_and_Data_Analysis",
  "database":    "Database_and_Storage",
  "devops":      "devops",
  "other":       "Other",
};

// ─── Types ───────────────────────────────────────────────────────────────────
interface Template {
  name: string;
  file: string;
  category: string;
  fullPath: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function listTemplates(category?: string): Template[] {
  const results: Template[] = [];
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
      `🔗 Nodes: ${nodes.slice(0, 8).join(" → ")}${nodes.length > 8 ? " ..." : ""}\n` +
      `📦 Total nodes: ${nodes.length}`
    );
  } catch {
    return "⚠️ Could not parse template.";
  }
}

async function deployTemplate(filePath: string): Promise<string> {
  if (!N8N_API_KEY) return "⚠️ N8N_API_KEY not set. Add it to your .env file.";
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const workflow = JSON.parse(raw);
    const res = await fetch(`${N8N_API_URL}/workflows`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-N8N-API-KEY": N8N_API_KEY,
      },
      body: JSON.stringify({
        name: workflow.name || "Imported Workflow",
        nodes: workflow.nodes || [],
        connections: workflow.connections || {},
        settings: workflow.settings || {},
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return `❌ Deploy failed: ${res.status} — ${err}`;
    }
    const data = await res.json() as any;
    return `✅ Deployed! ID: ${data.id} — Open http://localhost:5678/home/workflows to activate.`;
  } catch (err: any) {
    return `❌ Deploy error: ${err.message}`;
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
export async function handleN8nCommand(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const sub = parts[0]?.toLowerCase();
  const rest = parts.slice(1).join(" ");

  // /n8n help
  if (!sub || sub === "help") {
    return (
      `🤖 *hapdabot n8n Template Manager*\n\n` +
      `*/n8n list* — List all templates\n` +
      `*/n8n list [category]* — Filter by category (email, ai, social, pdf, notion, etc.)\n` +
      `*/n8n search [query]* — Search templates by name\n` +
      `*/n8n preview [#]* — Preview a template from last list/search\n` +
      `*/n8n deploy [#]* — Deploy template to your n8n instance\n\n` +
      `Categories: ${Object.keys(CATEGORY_MAP).join(", ")}`
    );
  }

  // /n8n list [category]
  if (sub === "list") {
    const templates = listTemplates(rest || undefined);
    if (!templates.length) return `⚠️ No templates found${rest ? ` in category: ${rest}` : ""}.`;
    const lines = templates.slice(0, 20).map((t, i) => `${i + 1}. [${t.category}] ${t.name}`);
    return `📚 *n8n Templates* (${templates.length} total):\n\n` + lines.join("\n") +
      (templates.length > 20 ? `\n\n...and ${templates.length - 20} more. Use /n8n search to narrow down.` : "");
  }

  // /n8n search [query]
  if (sub === "search") {
    if (!rest) return "Usage: /n8n search [keyword]";
    const results = searchTemplates(rest);
    if (!results.length) return `🔍 No templates matching "${rest}"`;
    const lines = results.slice(0, 15).map((t, i) => `${i + 1}. [${t.category}] ${t.name}`);
    return `🔍 *Results for "${rest}"* (${results.length} found):\n\n` + lines.join("\n");
  }

  // /n8n preview [number] — requires a prior search/list stored in session
  // For now return a tip — full session state can be added via hapdabot's memory
  if (sub === "preview") {
    return `💡 Run /n8n list or /n8n search first, then use /n8n preview [number] to see node breakdown.`;
  }

  // /n8n deploy [filename]
  if (sub === "deploy") {
    if (!rest) return "Usage: /n8n deploy [partial filename or search term]";
    const matches = searchTemplates(rest);
    if (!matches.length) return `? No templates found matching "${rest}"`;
    const t = matches[0];
    const result = await deployTemplate(t.fullPath);
    return `?? *${t.name}*\n${result}`;
  }

  return `❓ Unknown subcommand: ${sub}. Try /n8n help`;
}

// ─── Express / Telegram Hook Integration ─────────────────────────────────────
// In your bot's message router, add:
//
//   if (text.startsWith("/n8n")) {
//     const result = await handleN8nCommand(text.replace("/n8n", "").trim());
//     await sendMessage(chatId, result);
//   }
