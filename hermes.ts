import { createClient } from '@supabase/supabase-js';
import "dotenv/config";
import * as readline from 'readline';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as cheerio from 'cheerio';
import { chromium, Browser, Page } from 'playwright';
import { notify } from './notify';

const execAsync = promisify(exec);
const SESSION_ID = `session_${Date.now()}`;

let context: any = null;

async function getBrowser(): Promise<Page> {
    if (!browser) {
        browser = await chromium.launch({ 
            headless: false,
            args: ['--disable-blink-features=AutomationControlled'] 
        });
    }
    if (!context) {
        context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
        });
    }
    if (!page || page.isClosed()) {
        page = await context.newPage();
    }
    return page;
}

async function loadContext(): Promise<string> {
    try { return await fs.readFile('hermes_context.json', 'utf-8'); }
    catch { return '{}'; }
}

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function isDestructive(toolName: string, args: any): boolean {
    if (toolName === 'delete_file' || toolName === 'cancel_task') return true;
    if (toolName === 'write_file') {
        const p = (args.path || '').toLowerCase();
        if (p.includes('windows\\') || p.includes('program files')) return true;
        return false;
    }
    if (toolName === 'browser_click' || toolName === 'browser_type') {
        const t = (args.selector || args.text || '').toLowerCase();
        if (t.includes('delete') || t.includes('purchase') || t.includes('buy')) return true;
        return false;
    }
    if (toolName === 'run_shell') {
        const cmd = (args.command || '').toLowerCase();
        const dangerous = [
            /\brm\s+-rf\b/, /\bremove-item.*-recurse/, /\bdel\s+\/[sf]/,
            /\brmdir\s+\/s/, /\bformat\s+[a-z]:/, /\bformat-volume/,
            /\bwinget\s+(install|uninstall)/, /\bchoco\s+(install|uninstall)/,
            /\bnpm\s+uninstall/, /\bshutdown\b/, /\brestart-computer/,
            /\bstop-process.*-force/, /\bdrop\s+(table|database)/,
            /\binvoke-webrequest.*\|.*iex/, /\bcurl.*\|.*sh/,
            /\breg\s+(delete|add)/, /\bnetsh\s+/
        ];
        return dangerous.some(re => re.test(cmd));
    }
    return false;
}

async function askPermission(action: string, details: string): Promise<boolean> {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        console.log(`\n[!] PERMISSION REQUEST`);
        console.log(`   Action: ${action}`);
        console.log(`   Details: ${details}`);
        rl.question(`   Allow? (y/n): `, (answer) => {
            rl.close();
            resolve(answer.toLowerCase().startsWith('y'));
        });
    });
}

const tools = [
    { type: 'function', function: { name: 'list_files', description: 'List files in directory', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
    { type: 'function', function: { name: 'read_file', description: 'Read a file', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
    { type: 'function', function: { name: 'write_file', description: 'Write content to file', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } },
    { type: 'function', function: { name: 'delete_file', description: 'Delete file or folder', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
    { type: 'function', function: { name: 'run_shell', description: 'Execute PowerShell command', parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } } },
    { type: 'function', function: { name: 'fetch_url', description: 'Fetch URL text content', parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } } },
    { type: 'function', function: { name: 'web_search', description: 'Search the web', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
    { type: 'function', function: { name: 'update_context', description: 'Update persistent context', parameters: { type: 'object', properties: { key_path: { type: 'string' }, value: { type: 'string' } }, required: ['key_path', 'value'] } } },
    { type: 'function', function: { name: 'browser_open', description: 'Open URL in real Chrome window', parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } } },
    { type: 'function', function: { name: 'browser_click', description: 'Click element by CSS selector or text=Text', parameters: { type: 'object', properties: { selector: { type: 'string' } }, required: ['selector'] } } },
    { type: 'function', function: { name: 'browser_type', description: 'Type into form field by CSS selector', parameters: { type: 'object', properties: { selector: { type: 'string' }, text: { type: 'string' } }, required: ['selector', 'text'] } } },
    { type: 'function', function: { name: 'browser_screenshot', description: 'Screenshot current page', parameters: { type: 'object', properties: { path: { type: 'string' } } } } },
    { type: 'function', function: { name: 'browser_extract', description: 'Extract visible text from page', parameters: { type: 'object', properties: {} } } },
    { type: 'function', function: { name: 'browser_eval', description: 'Run JavaScript in page', parameters: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } } },
    { type: 'function', function: { name: 'schedule_task', description: 'Schedule a recurring task. Cron format: "minute hour day month dayofweek". Examples: "0 8 * * *" = 8am daily, "*/30 * * * *" = every 30 min, "0 9 * * 1" = 9am Mondays', parameters: { type: 'object', properties: { name: { type: 'string', description: 'Short task name' }, cron_expression: { type: 'string', description: 'Cron format' }, instruction: { type: 'string', description: 'What to do when task fires (full natural language instruction)' } }, required: ['name', 'cron_expression', 'instruction'] } } },
    { type: 'function', function: { name: 'list_tasks', description: 'List all scheduled tasks', parameters: { type: 'object', properties: {} } } },
    { type: 'function', function: { name: 'cancel_task', description: 'Cancel a scheduled task by id', parameters: { type: 'object', properties: { task_id: { type: 'number' } }, required: ['task_id'] } } },
    { type: 'function', function: { name: 'notify', description: 'Send a Windows toast notification to hap', parameters: { type: 'object', properties: { title: { type: 'string' }, message: { type: 'string' } }, required: ['title', 'message'] } } }
];

async function executeTool(name: string, args: any): Promise<string> {
    try {
        if (isDestructive(name, args)) {
            const allowed = await askPermission(name, JSON.stringify(args));
            if (!allowed) return 'DENIED';
        }
        switch (name) {
            case 'list_files': {
                const items = await fs.readdir(args.path, { withFileTypes: true });
                return items.map(i => `${i.isDirectory() ? '[DIR]' : '[FILE]'} ${i.name}`).join('\n') || '(empty)';
            }
            case 'read_file': {
                const content = await fs.readFile(args.path, 'utf-8');
                return content.length > 5000 ? content.slice(0, 5000) + '\n...(truncated)' : content;
            }
            case 'write_file': {
                await fs.mkdir(path.dirname(args.path), { recursive: true });
                await fs.writeFile(args.path, args.content, 'utf-8');
                return `Wrote ${args.content.length} bytes to ${args.path}`;
            }
            case 'delete_file': {
                await fs.rm(args.path, { recursive: true, force: true });
                return `Deleted: ${args.path}`;
            }
            case 'run_shell': {
                const { stdout, stderr } = await execAsync(`powershell -Command "${args.command.replace(/"/g, '\\"')}"`, { maxBuffer: 10 * 1024 * 1024 });
                return (stdout + (stderr ? `\nSTDERR: ${stderr}` : '')).slice(0, 5000);
            }
            case 'fetch_url': {
                const res = await fetch(args.url);
                const html = await res.text();
                const $ = cheerio.load(html);
                $('script, style').remove();
                return $('body').text().replace(/\s+/g, ' ').trim().slice(0, 5000);
            }
            case 'web_search': {
                const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(args.query)}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                const html = await res.text();
                const $ = cheerio.load(html);
                const results: string[] = [];
                $('.result').slice(0, 5).each((_, el) => {
                    const title = $(el).find('.result__title').text().trim();
                    const snippet = $(el).find('.result__snippet').text().trim();
                    const link = $(el).find('.result__url').text().trim();
                    if (title) results.push(`${title}\n${link}\n${snippet}`);
                });
                return results.join('\n\n---\n\n') || 'No results found';
            }
            case 'update_context': {
                const ctxRaw = await fs.readFile('hermes_context.json', 'utf-8');
                const ctx = JSON.parse(ctxRaw);
                const keys = args.key_path.split('.');
                let obj = ctx;
                for (let i = 0; i < keys.length - 1; i++) {
                    if (!obj[keys[i]]) obj[keys[i]] = {};
                    obj = obj[keys[i]];
                }
                obj[keys[keys.length - 1]] = args.value;
                await fs.writeFile('hermes_context.json', JSON.stringify(ctx, null, 2), 'utf-8');
                return `Context updated: ${args.key_path} = ${args.value}`;
            }
            case 'browser_open': {
                const p = await getBrowser();
                await p.goto(args.url, { waitUntil: 'networkidle', timeout: 60000 });
                return `Opened: ${args.url} | Title: ${await p.title()}`;
            }
            case 'browser_click': {
                const p = await getBrowser();
                if (args.selector.startsWith('text=')) {
                    await p.getByText(args.selector.slice(5)).first().click({ timeout: 10000 });
                } else {
                    await p.locator(args.selector).first().click({ timeout: 10000 });
                }
                return `Clicked: ${args.selector}`;
            }
            case 'browser_type': {
                const p = await getBrowser();
                await p.locator(args.selector).first().fill(args.text, { timeout: 10000 });
                return `Typed into ${args.selector}`;
            }
            case 'browser_screenshot': {
                const p = await getBrowser();
                const savePath = args.path || 'C:\\Users\\hustl\\Desktop\\hermes_screenshot.png';
                await p.screenshot({ path: savePath, fullPage: true });
                return `Screenshot saved: ${savePath}`;
            }
            case 'browser_extract': {
                const p = await getBrowser();
                const text = await p.evaluate(() => document.body.innerText);
                return text.slice(0, 5000);
            }
            case 'browser_eval': {
                const p = await getBrowser();
                const result = await p.evaluate(args.code);
                return JSON.stringify(result).slice(0, 3000);
            }
            case 'schedule_task': {
                const { data, error } = await supabase.from('scheduled_tasks').insert({
                    name: args.name,
                    cron_expression: args.cron_expression,
                    instruction: args.instruction,
                    status: 'active'
                }).select().single();
                if (error) return `ERROR: ${error.message}`;
                return `Task scheduled: id=${data.id} name="${args.name}" cron="${args.cron_expression}". The daemon will execute it on schedule. Make sure hermes_daemon.ts is running.`;
            }
            case 'list_tasks': {
                const { data, error } = await supabase.from('scheduled_tasks').select('*').order('id');
                if (error) return `ERROR: ${error.message}`;
                if (!data || data.length === 0) return 'No scheduled tasks.';
                return data.map(t => `[${t.id}] ${t.status} | "${t.name}" | cron: ${t.cron_expression} | runs: ${t.run_count} | last: ${t.last_run || 'never'}\n   -> ${t.instruction.slice(0, 100)}`).join('\n\n');
            }
            case 'cancel_task': {
                const { error } = await supabase.from('scheduled_tasks').update({ status: 'cancelled' }).eq('id', args.task_id);
                if (error) return `ERROR: ${error.message}`;
                return `Task ${args.task_id} cancelled`;
            }
            case 'notify': {
                notify(args.title, args.message);
                return `Notification sent: ${args.title}`;
            }
            default: return `Unknown tool: ${name}`;
        }
    } catch (err: any) { return `ERROR: ${err.message}`; }
}

async function getCredential(key: string): Promise<string | null> {
    const { data } = await supabase.from('hapda_credentials').select('value').eq('key', key).single();
    return data?.value || null;
}

async function saveMemory(role: string, content: string, metadata: any = {}) {
    await supabase.from('hermes_memory').insert({ session_id: SESSION_ID, role, content, metadata });
}

async function logOps(level: string, message: string, context: any = {}) {
    await supabase.from('ops_logs').insert({ level, message, context });
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

async function chat() {
    const context = await loadContext();
    const SYSTEM_PROMPT = `You are Hermes, hap's personal AI operator on Windows.

PERSISTENT CONTEXT:
${context}

CAPABILITIES:
- File system: list, read, write, delete
- Shell: PowerShell commands (NEVER Linux syntax)
- Web: fetch URLs, search DuckDuckGo
- Browser: open Chrome window (browser_open), click, type, screenshot, extract text, run JS
- Scheduler: schedule_task (cron), list_tasks, cancel_task
- Notifications: notify (Windows toast)
- Memory: update_context to save things permanently

SEARCH STRATEGY:
- ALWAYS use web_search tool first (DuckDuckGo - no bot blocks)
- For deeper reading, use fetch_url on the result URLs
- ONLY use browser_open when you need to interact (login, click, fill forms)
- AVOID browsing Google directly - they block bots

CRON CHEAT SHEET:
- "0 8 * * *" = 8:00am every day
- "*/30 * * * *" = every 30 minutes
- "0 */2 * * *" = every 2 hours
- "0 9 * * 1" = 9:00am every Monday
- "0 0 1 * *" = midnight on the 1st of every month

RULES:
- Use tools immediately - don't ask permission for safe actions
- Use PowerShell syntax always
- Be concise. No fluff.
- When scheduling tasks, write clear instructions for your future self to execute
- For destructive actions, briefly say what you'll do before tool call`;

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('\n=== HERMES ONLINE (Tier 2.2 - Scheduler + Notifications) ===');
    console.log(`Session: ${SESSION_ID}`);
    console.log('Tools: file, shell, web, browser, scheduler, notify');
    console.log('Run "npx tsx hermes_daemon.ts" in another window to enable scheduled tasks');
    console.log('Type "exit" to quit\n');
    await logOps('info', 'Hermes Tier 2.2 started', { session: SESSION_ID });
    const messages: any[] = [{ role: 'system', content: SYSTEM_PROMPT }];

    const ask = () => {
        rl.question('You: ', async (input) => {
            const text = input.trim();
            if (!text) return ask();
            if (text === 'exit') {
                console.log('Hermes signing off.');
                if (browser) await browser.close();
                rl.close();
                return;
            }
            messages.push({ role: 'user', content: text });
            await saveMemory('user', text);
            try {
                let loopCount = 0;
                while (loopCount++ < 15) {
                    const reply = await askGLM(messages);
                    messages.push(reply);
                    if (reply.tool_calls && reply.tool_calls.length > 0) {
                        for (const call of reply.tool_calls) {
                            const args = JSON.parse(call.function.arguments);
                            console.log(`\n[Tool] ${call.function.name}(${JSON.stringify(args).slice(0, 100)})`);
                            const result = await executeTool(call.function.name, args);
                            console.log(`   Result: ${result.slice(0, 200)}${result.length > 200 ? '...' : ''}\n`);
                            await saveMemory('tool', result, { tool: call.function.name, args });
                            messages.push({ role: 'tool', tool_call_id: call.id, content: result });
                        }
                        continue;
                    }
                    if (reply.content) {
                        await saveMemory('assistant', reply.content);
                        console.log(`Hermes: ${reply.content}\n`);
                    }
                    break;
                }
            } catch (err: any) {
                console.error('Error:', err.message);
                await logOps('error', 'Hermes loop failed', { error: err.message });
            }
            ask();
        });
    };
    ask();
}

chat();