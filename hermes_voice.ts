import { createClient } from '@supabase/supabase-js';
import "dotenv/config";
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as cheerio from 'cheerio';
import { listen, speak } from './voice';

const execAsync = promisify(exec);
const SESSION_ID = `voice_${Date.now()}`;

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function loadContext(): Promise<string> {
    try { return await fs.readFile('hermes_context.json', 'utf-8'); }
    catch { return '{}'; }
}

async function getCredential(key: string): Promise<string | null> {
    const { data } = await supabase.from('hapda_credentials').select('value').eq('key', key).single();
    return data?.value || null;
}

async function saveMemory(role: string, content: string) {
    await supabase.from('hermes_memory').insert({ session_id: SESSION_ID, role, content });
}

const tools = [
    { type: 'function', function: { name: 'list_files', description: 'List files in a directory', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
    { type: 'function', function: { name: 'read_file', description: 'Read a file', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
    { type: 'function', function: { name: 'write_file', description: 'Write to file', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } },
    { type: 'function', function: { name: 'run_shell', description: 'Run PowerShell command', parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } } },
    { type: 'function', function: { name: 'web_search', description: 'Search the web', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
    { type: 'function', function: { name: 'fetch_url', description: 'Fetch URL text', parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } } },
    { type: 'function', function: { name: 'open_url', description: 'Open URL in user default browser (visible)', parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } } }
];

async function executeTool(name: string, args: any): Promise<string> {
    try {
        switch (name) {
            case 'list_files': {
                const items = await fs.readdir(args.path, { withFileTypes: true });
                return items.map(i => `${i.isDirectory() ? '[DIR]' : '[FILE]'} ${i.name}`).join('\n') || '(empty)';
            }
            case 'read_file': {
                const c = await fs.readFile(args.path, 'utf-8');
                return c.length > 3000 ? c.slice(0, 3000) + '...' : c;
            }
            case 'write_file': {
                await fs.mkdir(path.dirname(args.path), { recursive: true });
                await fs.writeFile(args.path, args.content, 'utf-8');
                return `Wrote ${args.content.length} bytes to ${args.path}`;
            }
            case 'run_shell': {
                const { stdout, stderr } = await execAsync(`powershell -Command "${args.command.replace(/"/g, '\\"')}"`, { maxBuffer: 5 * 1024 * 1024 });
                return (stdout + (stderr ? `\nSTDERR: ${stderr}` : '')).slice(0, 3000);
            }
            case 'web_search': {
                const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(args.query)}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                const html = await res.text();
                const $ = cheerio.load(html);
                const results: string[] = [];
                $('.result').slice(0, 3).each((_, el) => {
                    const title = $(el).find('.result__title').text().trim();
                    const snippet = $(el).find('.result__snippet').text().trim();
                    if (title) results.push(`${title}: ${snippet}`);
                });
                return results.join('\n---\n') || 'No results';
            }
            case 'fetch_url': {
                const res = await fetch(args.url);
                const html = await res.text();
                const $ = cheerio.load(html);
                $('script, style').remove();
                return $('body').text().replace(/\s+/g, ' ').trim().slice(0, 3000);
            }
            case 'open_url': {
                await execAsync(`start "" "${args.url}"`);
                return `Opened ${args.url} in default browser`;
            }
            default: return `Unknown tool: ${name}`;
        }
    } catch (err: any) { return `ERROR: ${err.message}`; }
}

async function askGLM(messages: any[]): Promise<any> {
    const apiKey = await getCredential('GLM_API_KEY');
    if (!apiKey) throw new Error('No GLM key');
    const response = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'glm-4.5-flash', messages, tools, tool_choice: 'auto' })
    });
    const data = await response.json();
    if (!data.choices?.[0]) throw new Error(JSON.stringify(data));
    return data.choices[0].message;
}

async function main() {
    const context = await loadContext();
    const SYSTEM_PROMPT = `You are Hermes, hap's voice AI operator on Windows.

CONTEXT: ${context}

VOICE MODE RULES:
- Keep SPOKEN responses SHORT (1-2 sentences max). User HEARS them.
- USE TOOLS - don't just talk about them. If hap says "what's in downloads", actually list_files.
- After using a tool, summarize the result in plain spoken English (no paths, no markdown, no code).
- Use PowerShell syntax for run_shell (Get-ChildItem, Get-Process, etc).
- Common folders: Downloads = C:\\Users\\hustl\\Downloads, Desktop = C:\\Users\\hustl\\Desktop, Documents = C:\\Users\\hustl\\Documents

EXAMPLES:
hap: "what's on my desktop"
You: [call list_files for Desktop] then say "You've got 12 files on your desktop, mostly screenshots and a few documents."

hap: "open YouTube"
You: [call open_url with youtube.com] then say "YouTube's open."

hap: "what's the weather"
You: [call web_search] then say "It's 72 and sunny in Atlanta."`;

    const messages: any[] = [{ role: 'system', content: SYSTEM_PROMPT }];

    await speak("Voice mode online with full tools. I am listening hap.");

    while (true) {
        const heard = await listen(6);
        if (!heard || heard.includes('[BLANK_AUDIO]') || heard.length < 2) {
            console.log('(silence)');
            continue;
        }
        if (/^(stop|exit|quit|goodbye|bye hermes)\.?$/i.test(heard.trim())) {
            await speak("Catch you later hap.");
            break;
        }
        console.log(`\nYou: ${heard}`);
        await saveMemory('user', heard);
        messages.push({ role: 'user', content: heard });

        try {
            let loopCount = 0;
            while (loopCount++ < 10) {
                const reply = await askGLM(messages);
                messages.push(reply);

                if (reply.tool_calls && reply.tool_calls.length > 0) {
                    for (const call of reply.tool_calls) {
                        const args = JSON.parse(call.function.arguments);
                        console.log(`[Tool] ${call.function.name}(${JSON.stringify(args).slice(0, 80)})`);
                        const result = await executeTool(call.function.name, args);
                        console.log(`  -> ${result.slice(0, 150)}${result.length > 150 ? '...' : ''}`);
                        await saveMemory('tool', result);
                        messages.push({ role: 'tool', tool_call_id: call.id, content: result });
                    }
                    continue;
                }

                if (reply.content) {
                    await saveMemory('assistant', reply.content);
                    console.log(`Hermes: ${reply.content}`);
                    await speak(reply.content);
                }
                break;
            }
        } catch (err: any) {
            console.error('Error:', err.message);
            await speak("I had a glitch, try again.");
        }
    }
}

main().catch(console.error);