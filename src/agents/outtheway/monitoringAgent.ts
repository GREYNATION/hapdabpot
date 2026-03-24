// ============================================================
// OUT THE WAY — Monitoring Agent
// Tracks all agent events, writes dashboard.json, retries failures
// ============================================================

import fs from "fs";
import path from "path";
import { log } from "../../core/config.js";
import type {
    AgentEvent,
    AgentName,
    AgentStatus,
    AgentStatusEntry,
    Dashboard,
} from "./types.js";

const DATA_DIR = path.join(process.cwd(), "data", "outtheway");
const DASHBOARD_PATH = path.join(DATA_DIR, "dashboard.json");
const LOG_PATH = path.join(DATA_DIR, "monitor.log");
const MAX_LOG_EVENTS = 500;

export class MonitoringAgent {
    private dashboard: Dashboard;
    private retryRegistry: Map<AgentName, number> = new Map();
    private readonly MAX_RETRIES = 3;

    constructor(episodeNumber: number) {
        this.ensureDataDir();

        const blankEntry = (): AgentStatusEntry => ({
            status: "idle",
            lastUpdate: new Date().toISOString(),
        });

        this.dashboard = {
            episodeNumber,
            startedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            agents: {
                story: blankEntry(),
                scene: blankEntry(),
                production: blankEntry(),
                assembly: blankEntry(),
                posting: blankEntry(),
                marketing: blankEntry(),
                music: blankEntry(),
                monitoring: { status: "active", lastUpdate: new Date().toISOString(), message: "Monitoring agent online" },
            },
            logs: [],
        };

        this.saveDashboard();
        log(`[monitoring] Agent initialized for episode ${episodeNumber}`);
    }

    // ── Public API ────────────────────────────────────────────

    /** Receive an event from any agent and update dashboard */
    public report(event: AgentEvent): void {
        const ts = new Date().toISOString();
        event.timestamp = ts;

        // Update agent status entry
        this.dashboard.agents[event.agent] = {
            status: event.status,
            lastUpdate: ts,
            message: event.message,
        };

        // Append to logs (cap size)
        this.dashboard.logs.push(event);
        if (this.dashboard.logs.length > MAX_LOG_EVENTS) {
            this.dashboard.logs = this.dashboard.logs.slice(-MAX_LOG_EVENTS);
        }

        this.dashboard.lastUpdated = ts;
        this.saveDashboard();
        this.writeLogLine(event);

        const icon = this.statusIcon(event.status);
        log(`[monitoring] ${icon} [${event.agent.toUpperCase()}] ${event.status.toUpperCase()} — ${event.message}`);

        // Track retries for failed agents
        if (event.status === "failed") {
            const retries = (this.retryRegistry.get(event.agent) ?? 0) + 1;
            this.retryRegistry.set(event.agent, retries);

            if (retries >= this.MAX_RETRIES) {
                log(`[monitoring] ⛔ Agent [${event.agent}] has FAILED ${retries}x — marking unrecoverable.`, "error");
                this.report({
                    agent: "monitoring",
                    status: "active",
                    message: `Agent [${event.agent}] flagged unrecoverable after ${retries} retries.`,
                    timestamp: ts,
                });
            } else {
                log(`[monitoring] 🔁 Agent [${event.agent}] failed (attempt ${retries}/${this.MAX_RETRIES}). Retry recommended.`, "warn");
            }
        } else if (event.status === "completed") {
            // Reset retry counter on success
            this.retryRegistry.delete(event.agent);
        }
    }

    /** Check if an agent has exceeded max retries */
    public isUnrecoverable(agent: AgentName): boolean {
        return (this.retryRegistry.get(agent) ?? 0) >= this.MAX_RETRIES;
    }

    /** Get retry count for an agent */
    public getRetryCount(agent: AgentName): number {
        return this.retryRegistry.get(agent) ?? 0;
    }

    /** Set the final video path in the dashboard */
    public setFinalVideo(videoPath: string): void {
        this.dashboard.finalVideoPath = videoPath;
        this.dashboard.lastUpdated = new Date().toISOString();
        this.saveDashboard();
    }

    /** Print a pretty summary of current agent statuses */
    public printSummary(): void {
        log(`\n━━━━━━━━━━━━ OUT THE WAY — SYSTEM STATUS ━━━━━━━━━━━━`);
        log(`Episode: ${this.dashboard.episodeNumber} | Started: ${this.dashboard.startedAt}`);
        log(`─────────────────────────────────────────────────────`);
        for (const [agentName, entry] of Object.entries(this.dashboard.agents)) {
            const icon = this.statusIcon(entry.status as AgentStatus);
            log(`  ${icon} ${agentName.padEnd(12)} → ${entry.status.toUpperCase()} | ${entry.message ?? ""}`);
        }
        log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    }

    /** Get the current dashboard snapshot */
    public getDashboard(): Dashboard {
        return { ...this.dashboard };
    }

    // ── Private Helpers ───────────────────────────────────────

    private ensureDataDir(): void {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
    }

    private saveDashboard(): void {
        fs.writeFileSync(DASHBOARD_PATH, JSON.stringify(this.dashboard, null, 2), "utf-8");
    }

    private writeLogLine(event: AgentEvent): void {
        const line = `[${event.timestamp}] [${event.agent}] ${event.status.toUpperCase()}: ${event.message}${event.output ? ` | OUTPUT: ${event.output}` : ""}\n`;
        fs.appendFileSync(LOG_PATH, line, "utf-8");
    }

    private statusIcon(status: AgentStatus): string {
        switch (status) {
            case "active":    return "🔄";
            case "idle":      return "⏸️ ";
            case "completed": return "✅";
            case "failed":    return "❌";
        }
    }
}
