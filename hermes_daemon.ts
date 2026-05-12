import { createClient } from '@supabase/supabase-js';
import "dotenv/config";
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as cheerio from 'cheerio';
import * as cron from 'node-cron';
import { notify } from './notify';

const execAsync = promisify(exec);

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const activeJobs = new Map<number, cron.ScheduledTask>();

const tools = [
    { type: 'function', function: { name: 'list_files', description: 'List files', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
    { type: 'function', function: { name: 'read_file', description: 'Read file', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
    { type: 'function', function: { name: 'write_file', description: 'Write file', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } },
    { type: 'function', function: { name: 'run_shell', description: 'Run PowerShell', parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } } },
    { type: 'function', function: { name: 'fetch_url', description: 'Fetch URL text', parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } } },
    { type: 'function', function: { name: 'web_search', description: 'Search web', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
    { type: 'function', function: { name: 'notify', description: 'Send Windows toast', parameters: { type: 'object', properties: { title: { type: 'string' }, message: { type: 'string' } }, required: ['title', 'message'] } } }
];

async function executeTool(name: string, args: any): Promise<string> {
    try {
        switch (name) {
            case 'list_files': {
                const items = await fs.readdir(args.path, { withFileTypes: true });
                return items.map(i => `${i.isDirectory() ? '[DIR]' : '[FILE]'} ${i.name}`).join('\n') || '(empty)';
            }
            case 'read_file': {
                const content = await fs.readFile(args.path, 'utf-8');
                return content.length > 5000 ? content.slice(0, 5000) + '...(truncated)' : content;
            }
            case 'write_file': {
                await fs.mkdir(path.dirname(args.path), { recursive: true });
                await fs.writeFile(args.path, args.content, 'utf-8');
                return `Wrote ${args.content.length} bytes`;
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
                    if (title) results.push(`${title}\n${snippet}`);
                });
                return results.join('\n---\n') || 'No results';
            }
            case 'notify': {
                notify(args.title, args.message);
                return `Notification sent`;
            }
            default: return `Unknown: ${name}`;
        }
    } catch (err: any) { return `ERROR: ${err.message}`; }
}

async function getCredential(key: string): Promise<string | null> {
    const { data } = await supabase.from('hapda_credentials').select('value').eq('key', key).single();
    return data?.value || null;
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

async function executeTask(taskId: number, taskName: string, instruction: string) {
    console.log(`\n[${new Date().toLocaleString()}] Firing task: "${taskName}"`);
    await logOps('info', `Task fired: ${taskName}`, { task_id: taskId });

    const SYSTEM_PROMPT = `You are Hermes daemon executing a scheduled task.
Use tools to complete the instruction. Be efficient.
When done, send a notify() to inform hap that the task completed.`;

    const messages: any[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: instruction }
    ];

    try {
        let loopCount = 0;
        while (loopCount++ < 15) {
            const reply = await askGLM(messages);
            messages.push(reply);
            if (reply.tool_calls && reply.tool_calls.length > 0) {
                for (const call of reply.tool_calls) {
                    const args = JSON.parse(call.function.arguments);
                    console.log(`  [Tool] ${call.function.name}`);
                    const result = await executeTool(call.function.name, args);
                    messages.push({ role: 'tool', tool_call_id: call.id, content: result });
                }
                continue;
            }
            if (reply.content) console.log(`  [Done] ${reply.content.slice(0, 200)}`);
            break;
        }

        await supabase.from('scheduled_tasks').update({
            last_run: new Date().toISOString(),
            run_count: (await supabase.from('scheduled_tasks').select('run_count').eq('id', taskId).single()).data!.run_count + 1
        }).eq('id', taskId);

    } catch (err: any) {
        console.error(`  [Error] ${err.message}`);
        await logOps('error', `Task failed: ${taskName}`, { error: err.message });
    }
}

async function loadAndScheduleTasks() {
    const { data, error } = await supabase.from('scheduled_tasks').select('*').eq('status', 'active');
    if (error) { console.error('Load failed:', error); return; }

    // Cancel jobs that no longer exist or are inactive
    for (const [id, job] of activeJobs.entries()) {
        if (!data!.find(t => t.id === id)) {
            job.stop();
            activeJobs.delete(id);
        }
    }

    // Schedule new ones
    for (const task of data!) {
        if (activeJobs.has(task.id)) continue;
        if (!cron.validate(task.cron_expression)) {
            console.error(`Invalid cron for task ${task.id}: ${task.cron_expression}`);
            continue;
        }
        const job = cron.schedule(task.cron_expression, () => {
            executeTask(task.id, task.name, task.instruction);
        });
        activeJobs.set(task.id, job);
        console.log(`Scheduled: [${task.id}] "${task.name}" (${task.cron_expression})`);
    }
}

async function main() {
    console.log('\n=== HERMES DAEMON (Background Scheduler) ===');
    console.log('Loading scheduled tasks from Supabase...\n');
    await loadAndScheduleTasks();
    console.log(`\n${activeJobs.size} task(s) active. Daemon running. Press Ctrl+C to stop.\n`);

    // Reload tasks every 60 seconds (so new tasks added via chat get picked up)
    setInterval(loadAndScheduleTasks, 60000);
}

main();