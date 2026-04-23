import fs from "fs";
import path from "path";

const PROMPTS_DIR = process.env.AI_PROMPTS_DIR || "./ai-prompts";

interface PromptTool {
  name: string;
  dir: string;
  files: string[];
}

function listTools(): PromptTool[] {
  if (!fs.existsSync(PROMPTS_DIR)) return [];
  return fs.readdirSync(PROMPTS_DIR)
    .filter(d => {
      const full = path.join(PROMPTS_DIR, d);
      return fs.statSync(full).isDirectory() && !d.startsWith(".");
    })
    .map(d => ({
      name: d,
      dir: path.join(PROMPTS_DIR, d),
      files: fs.readdirSync(path.join(PROMPTS_DIR, d)).filter(f => f.endsWith(".txt") || f.endsWith(".json") || f.endsWith(".md")),
    }))
    .filter(t => t.files.length > 0);
}

function searchTools(query: string): PromptTool[] {
  const q = query.toLowerCase();
  return listTools().filter(t => t.name.toLowerCase().includes(q));
}

function readPrompt(toolName: string, fileName?: string): string {
  const tools = listTools();
  const tool = tools.find(t => t.name.toLowerCase().includes(toolName.toLowerCase()));
  if (!tool) return "Tool not found. Use /prompts list to see all tools.";

  const file = fileName
    ? tool.files.find(f => f.toLowerCase().includes(fileName.toLowerCase()))
    : tool.files.find(f => f.toLowerCase().includes("prompt")) || tool.files[0];

  if (!file) return "No prompt file found for " + tool.name;

  const content = fs.readFileSync(path.join(tool.dir, file), "utf-8");
  const preview = content.slice(0, 3500);
  const truncated = content.length > 3500 ? "\n\n...(truncated)" : "";
  return tool.name + " - " + file + "\n\n" + preview + truncated;
}

export async function handlePromptsCommand(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const sub = parts[0]?.toLowerCase();
  const rest = parts.slice(1).join(" ");

  if (!sub || sub === "help") {
    return "AI Prompts Browser\n\n/prompts list - List all tools\n/prompts search [name] - Search by name\n/prompts read [tool] - Read main prompt\n/prompts files [tool] - List files for a tool\n\nTools: Cursor, Devin, Manus, Windsurf, v0, Replit, Lovable, and more.";
  }

  if (sub === "list") {
    const tools = listTools();
    if (!tools.length) return "No tools found. Check AI_PROMPTS_DIR in .env";
    const lines = tools.map((t, i) => (i + 1) + ". " + t.name + " (" + t.files.length + " files)");
    return "AI System Prompts - " + tools.length + " tools:\n\n" + lines.join("\n");
  }

  if (sub === "search") {
    if (!rest) return "Usage: /prompts search [tool name]";
    const results = searchTools(rest);
    if (!results.length) return "No tools matching: " + rest;
    return "Results for " + rest + ":\n\n" + results.map((t, i) => (i + 1) + ". " + t.name).join("\n");
  }

  if (sub === "files") {
    if (!rest) return "Usage: /prompts files [tool name]";
    const tool = listTools().find(t => t.name.toLowerCase().includes(rest.toLowerCase()));
    if (!tool) return "Tool not found: " + rest;
    return tool.name + " files:\n\n" + tool.files.map((f, i) => (i + 1) + ". " + f).join("\n");
  }

  if (sub === "read") {
    if (!rest) return "Usage: /prompts read [tool name]";
    const toolName = parts[1];
    const fileName = parts[2];
    return readPrompt(toolName, fileName);
  }

  return "Unknown subcommand. Try /prompts help";
}