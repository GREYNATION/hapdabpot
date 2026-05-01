import { puter } from '@heyputer/puter.js';
import { log } from './config.js';

/**
 * Puter Service — Decentralized Cloud Intelligence
 * Provides AI, KV Storage, and Cloud Storage via Puter.js
 */
export class PuterService {
    private static instance: PuterService;
    private initialized = false;

    private constructor() {}

    static getInstance(): PuterService {
        if (!PuterService.instance) {
            PuterService.instance = new PuterService();
        }
        return PuterService.instance;
    }

    /**
     * AI Chat Completion via Puter
     */
    async ask(prompt: string, model: string = 'gpt-4o'): Promise<string> {
        try {
            const response = await puter.ai.chat(prompt, { model });
            return response.toString();
        } catch (err: any) {
            log(`[puter] AI failed: ${err.message}`, "error");
            throw err;
        }
    }

    /**
     * Key-Value Storage
     */
    async set(key: string, value: string): Promise<void> {
        try {
            await puter.kv.set(key, value);
        } catch (err: any) {
            log(`[puter] KV set failed: ${err.message}`, "error");
        }
    }

    async get(key: string): Promise<string | null> {
        try {
            const val = await puter.kv.get(key);
            return val ? val.toString() : null;
        } catch (err: any) {
            log(`[puter] KV get failed: ${err.message}`, "error");
            return null;
        }
    }

    /**
     * Cloud Storage (Files)
     */
    async saveFile(path: string, content: string | Buffer): Promise<void> {
        try {
            await puter.fs.write(path, content);
            log(`[puter] File saved to Puter: ${path}`);
        } catch (err: any) {
            log(`[puter] FS write failed: ${err.message}`, "error");
        }
    }
}

export const puterService = PuterService.getInstance();
