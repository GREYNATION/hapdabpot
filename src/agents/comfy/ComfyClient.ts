/**
 * ComfyClient.ts
 * Low-level HTTP + WebSocket client for the ComfyUI REST API.
 * Runs against a local or remote ComfyUI instance on port 8188.
 *
 * Docs: https://github.com/Comfy-Org/ComfyUI
 * API: POST /prompt  |  WS /ws  |  GET /history/{id}  |  GET /view
 */

import axios from "axios";
import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import WebSocket from "ws";

export interface ComfyPromptResult {
    promptId: string;
    outputs: ComfyOutput[];
}

export interface ComfyOutput {
    nodeId: string;
    type: "image" | "video" | "audio" | "file";
    filename: string;
    subfolder: string;
    url: string; // resolved full URL for download
}

export interface ComfyProgress {
    promptId: string;
    currentNode?: string;
    step?: number;
    totalSteps?: number;
    done: boolean;
}

const DEFAULT_HOST = process.env.COMFYUI_HOST || "127.0.0.1:8188";

export class ComfyClient extends EventEmitter {
    private host: string;
    private clientId: string;

    constructor(host: string = DEFAULT_HOST) {
        super();
        this.host = host;
        this.clientId = randomUUID();
    }

    get baseUrl(): string {
        return `http://${this.host}`;
    }

    get wsUrl(): string {
        return `ws://${this.host}/ws?clientId=${this.clientId}`;
    }

    // ─── Queue a workflow and wait for completion ─────────────────────────────

    async run(
        workflow: Record<string, any>,
        extraData?: Record<string, any>
    ): Promise<ComfyPromptResult> {
        const promptId = await this.queuePrompt(workflow, extraData);
        await this.waitForCompletion(promptId);
        const outputs = await this.getOutputs(promptId);
        return { promptId, outputs };
    }

    // ─── Queue a workflow ─────────────────────────────────────────────────────

    async queuePrompt(
        workflow: Record<string, any>,
        extraData?: Record<string, any>
    ): Promise<string> {
        const payload: Record<string, any> = {
            prompt: workflow,
            client_id: this.clientId,
        };
        if (extraData) payload.extra_data = extraData;

        const res = await axios.post(`${this.baseUrl}/prompt`, payload, {
            headers: { "Content-Type": "application/json" },
            timeout: 10_000,
        });

        const promptId = res.data?.prompt_id;
        if (!promptId) throw new Error(`ComfyUI: no prompt_id in response — ${JSON.stringify(res.data)}`);
        return promptId;
    }

    // ─── Wait for execution via WebSocket ─────────────────────────────────────

    waitForCompletion(
        promptId: string,
        timeoutMs = 300_000
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            let ws: WebSocket;
            let timer: ReturnType<typeof setTimeout>;

            const cleanup = () => {
                clearTimeout(timer);
                try { ws.close(); } catch {}
            };

            timer = setTimeout(() => {
                cleanup();
                reject(new Error(`ComfyUI: prompt ${promptId} timed out after ${timeoutMs / 1000}s`));
            }, timeoutMs);

            try {
                ws = new WebSocket(this.wsUrl);
            } catch (err: any) {
                clearTimeout(timer);
                reject(new Error(`ComfyUI: WebSocket connect failed — ${err.message}`));
                return;
            }

            ws.on("message", (raw: Buffer) => {
                try {
                    if (raw[0] !== 123) return; // binary frame (latent preview) — skip
                    const msg = JSON.parse(raw.toString());
                    if (msg.type === "progress") {
                        this.emit("progress", {
                            promptId,
                            currentNode: msg.data?.node,
                            step: msg.data?.value,
                            totalSteps: msg.data?.max,
                            done: false,
                        } as ComfyProgress);
                    }
                    if (msg.type === "executing") {
                        const data = msg.data;
                        if (data?.node == null && data?.prompt_id === promptId) {
                            cleanup();
                            resolve();
                        }
                    }
                } catch {}
            });

            ws.on("error", (err) => {
                cleanup();
                reject(new Error(`ComfyUI WebSocket error: ${err.message}`));
            });

            ws.on("close", () => {
                // If we closed because of timeout, reject was already called
            });
        });
    }

    // ─── Fetch output filenames from history ──────────────────────────────────

    async getOutputs(promptId: string): Promise<ComfyOutput[]> {
        const res = await axios.get(`${this.baseUrl}/history/${promptId}`, { timeout: 10_000 });
        const history = res.data?.[promptId];
        if (!history) return [];

        const outputs: ComfyOutput[] = [];
        for (const [nodeId, nodeOutput] of Object.entries(history.outputs || {})) {
            const output = nodeOutput as any;
            // Images
            for (const img of output.images || []) {
                outputs.push({
                    nodeId,
                    type: "image",
                    filename: img.filename,
                    subfolder: img.subfolder || "",
                    url: this.resolveOutputUrl(img.filename, img.subfolder, img.type),
                });
            }
            // Videos
            for (const vid of output.videos || []) {
                outputs.push({
                    nodeId,
                    type: "video",
                    filename: vid.filename,
                    subfolder: vid.subfolder || "",
                    url: this.resolveOutputUrl(vid.filename, vid.subfolder, vid.type),
                });
            }
            // Audio
            for (const aud of output.audio || []) {
                outputs.push({
                    nodeId,
                    type: "audio",
                    filename: aud.filename,
                    subfolder: aud.subfolder || "",
                    url: this.resolveOutputUrl(aud.filename, aud.subfolder, aud.type),
                });
            }
        }
        return outputs;
    }

    // ─── Download output bytes ────────────────────────────────────────────────

    async downloadOutput(output: ComfyOutput): Promise<Buffer> {
        const res = await axios.get(output.url, {
            responseType: "arraybuffer",
            timeout: 60_000,
        });
        return Buffer.from(res.data);
    }

    // ─── Server health ────────────────────────────────────────────────────────

    async isOnline(): Promise<boolean> {
        try {
            await axios.get(`${this.baseUrl}/system_stats`, { timeout: 3_000 });
            return true;
        } catch {
            return false;
        }
    }

    async getSystemStats(): Promise<any> {
        const res = await axios.get(`${this.baseUrl}/system_stats`, { timeout: 5_000 });
        return res.data;
    }

    async getAvailableModels(): Promise<string[]> {
        const res = await axios.get(`${this.baseUrl}/models/checkpoints`, { timeout: 5_000 });
        return res.data || [];
    }

    async getQueueStatus(): Promise<any> {
        const res = await axios.get(`${this.baseUrl}/queue`, { timeout: 5_000 });
        return res.data;
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private resolveOutputUrl(filename: string, subfolder: string, type: string = "output"): string {
        const params = new URLSearchParams({ filename, subfolder, type });
        return `${this.baseUrl}/view?${params.toString()}`;
    }
}

// Shared singleton
export const comfyClient = new ComfyClient();
