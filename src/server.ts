import "./core/init.js";
import 'dotenv/config';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { log } from './core/config.js';
import { HiveMind } from './core/hiveMind.js';
import { CouncilOrchestrator } from './core/orchestrator/councilOrchestrator.js';
import fs from 'fs';
import path from 'path';
import { uploadAudioAndGetUrl, generateVoice } from './services/voiceService.js';

import { serveStatic } from '@hono/node-server/serve-static';

const app = new Hono();
const orchestrator = new CouncilOrchestrator();

// Middleware
app.use('*', cors());
app.use('/console.js', serveStatic({ path: './src/web/console.js' }));
app.use('/style.css', serveStatic({ path: './src/web/style.css' }));

// UI Route
app.get('/', (c) => {
    const htmlPath = path.join(process.cwd(), 'src', 'web', 'console.html');
    try {
        const html = fs.readFileSync(htmlPath, 'utf-8');
        return c.html(html);
    } catch (e) {
        return c.text('Dashboard HTML not found', 404);
    }
});

// API: System Status
app.get('/api/status', (c) => {
    const hive = HiveMind.getInstance();
    return c.json({
        success: true,
        state: hive.getState(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// API: Config (Public Keys)
app.get('/api/config', (c) => {
    return c.json({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseKey: process.env.SUPABASE_ANON_KEY
    });
});

// API: Voice Synthesis Bridge (URL Getter)
app.post('/api/voice', async (c) => {
    const { text } = await c.req.json();
    if (!text) return c.json({ success: false, error: 'Text required' }, 400);

    try {
        const audioUrl = await uploadAudioAndGetUrl(text);
        return c.json({ success: true, audioUrl });
    } catch (err: any) {
        return c.json({ success: false, error: err.message }, 500);
    }
});

// API: Voice Audio Stream (Direct Fallback)
app.get('/api/voice/audio', async (c) => {
    const text = c.req.query('text');
    if (!text) return c.text('Text required', 400);

    try {
        const buffer = await generateVoice(text);
        c.header('Content-Type', 'audio/mpeg');
        return c.body(buffer as any);
    } catch (err: any) {
        return c.text('Voice generation failed', 500);
    }
});

// API: Command Bridge
app.post('/api/command', async (c) => {
    const { message, chatId } = await c.req.json();
    
    if (!message) return c.json({ success: false, error: 'Message required' }, 400);

    log(`[bridge] Command received from dashboard: ${message}`);
    
    // Trigger orchestrator (Background processing)
    const cid = chatId || 0;
    orchestrator.chat(message, cid).then(response => {
        log(`[bridge] Command processed. Result available in ops_logs.`);
    }).catch(err => {
        log(`[bridge] Command failed: ${err.message}`, "error");
    });

    return c.json({ 
        success: true, 
        message: 'Command accepted for processing.' 
    });
});

// Start Server
const port = 3141;
log(`[server] 🖥️ Hapdabot Command Center live on http://localhost:${port}`);

const server = serve({
    fetch: app.fetch,
    port
});

// WebSocket Relay for Ops Logs
import { WebSocketServer, WebSocket } from 'ws';
import { getSupabase } from './core/supabase.js';

const wss = new WebSocketServer({ server: server as any });

wss.on('connection', (ws_client: WebSocket) => {
    log('[server] Dashboard connected to log stream.');
    
    // Initial status/state could be sent here
    ws_client.send(JSON.stringify({ type: 'status', agent: 'SYSTEM', message: 'BRIDGE_CONNECTED: Secure channel established.' }));
});

// Subscribe to Supabase and Relay to WebSockets
const supabase = getSupabase();
if (supabase) {
    supabase
        .channel('ops_logs_relay')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ops_logs' }, (payload: any) => {
            const row = payload.new;
            const broadcastMessage = JSON.stringify({
                type: row.type || 'status',
                agent: row.agent || 'SYSTEM',
                message: row.message,
                timestamp: row.timestamp
            });
            
            wss.clients.forEach((client: WebSocket) => {
                if (client.readyState === 1) {
                    client.send(broadcastMessage);
                }
            });
        })
        .subscribe();
    log('[server] Ops Log relay active.');
}

// ── Neural Pulse (Stellar Heartbeat) ─────────────────────────────────────────
setInterval(() => {
    const heartbeat = JSON.stringify({
        type: 'heartbeat',
        agent: 'SYSTEM',
        status: 'online',
        timestamp: new Date().toISOString()
    });
    
    wss.clients.forEach((client: WebSocket) => {
        if (client.readyState === 1) {
            client.send(heartbeat);
        }
    });
}, 5000); // 5-second neural pulse
