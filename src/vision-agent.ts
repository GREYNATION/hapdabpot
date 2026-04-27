// vision-agent.ts — GREYNATION Vision System
// Captures screen → sends to Claude multimodal → returns what it sees

// @ts-ignore
import screenshot from 'screenshot-desktop';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SCREENSHOT_PATH = path.join(process.cwd(), 'screen-capture.jpg');

export async function captureScreen(): Promise<string> {
  const imgBuffer = await screenshot({ format: 'jpg' });
  fs.writeFileSync(SCREENSHOT_PATH, imgBuffer);
  return imgBuffer.toString('base64');
}

export async function analyzeScreen(prompt: string = 'What is on the screen right now? Describe everything you see in detail.'): Promise<string> {
  try {
    console.log('[vision] Capturing screen...');
    const base64Image = await captureScreen();

    console.log('[vision] Sending to Claude...');
    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    const result = response.content[0].type === 'text' ? response.content[0].text : 'Could not analyze screen.';
    console.log('[vision] Analysis:', result);
    return result;

  } catch (err: any) {
    console.error('[vision] Error:', err.message);
    return `Vision error: ${err.message}`;
  }
}

// HTTP server so OpenJarvis and Jarvis interface can call it
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();
app.use('*', cors());

app.get('/vision/status', (c) => {
  return c.json({ status: 'online', agent: 'vision' });
});

app.post('/vision/analyze', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const prompt = body.prompt || 'What is on the screen right now? Describe everything you see.';
  const result = await analyzeScreen(prompt);
  return c.json({ success: true, analysis: result });
});

app.get('/vision/screenshot', async (c) => {
  try {
    const imgBuffer = await screenshot({ format: 'jpg' });
    return new Response(imgBuffer, {
      headers: { 'Content-Type': 'image/jpeg' },
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

const PORT = 3200;
console.log(`[vision] 👁 Vision Agent running on http://localhost:${PORT}`);

serve({ fetch: app.fetch, port: PORT });

// If run directly, do a test capture
if (process.argv[2] === '--test') {
  analyzeScreen('What applications and windows are currently open on this screen?').then(result => {
    console.log('\n[vision] SCREEN ANALYSIS:\n', result);
    process.exit(0);
  });
}
