import fs from "fs";
import path from "path";
import { log } from "./config.js";
import { writeKnowledge } from "./memory.js";

const HIVE_PATH = path.join(process.cwd(), "hive", "state.json");

export interface HiveMindState {
    active_mission: string;
    objectives: string[];
    pinned_facts: Record<string, any>;
    agent_handoffs: Record<string, string>;
    pinned_agent_id: string | null;
    last_updated: string;
}

const DEFAULT_STATE: HiveMindState = {
    active_mission: "Idle",
    objectives: [],
    pinned_facts: {},
    agent_handoffs: {},
    pinned_agent_id: null,
    last_updated: new Date().toISOString()
};

export class HiveMind {
    private static instance: HiveMind;
    private state: HiveMindState;

    private constructor() {
        this.state = this.loadState();
    }

    public static getInstance() {
        if (!HiveMind.instance) HiveMind.instance = new HiveMind();
        return HiveMind.instance;
    }

    private loadState(): HiveMindState {
        try {
            if (!fs.existsSync(path.dirname(HIVE_PATH))) {
                fs.mkdirSync(path.dirname(HIVE_PATH), { recursive: true });
            }
            if (fs.existsSync(HIVE_PATH)) {
                return JSON.parse(fs.readFileSync(HIVE_PATH, "utf-8"));
            }
        } catch (e: any) {
            log(`[hive] Failed to load state: ${e.message}`, "error");
        }
        return { ...DEFAULT_STATE };
    }

    public getState(): HiveMindState {
        return this.state;
    }

    public updateState(patch: Partial<HiveMindState>) {
        this.state = {
            ...this.state,
            ...patch,
            last_updated: new Date().toISOString()
        };
        this.saveState();
    }

    public pinAgent(id: string | null) {
        this.state.pinned_agent_id = id;
        this.saveState();
    }

    public pinFact(key: string, value: any) {
        this.state.pinned_facts[key] = value;
        this.saveState();
        // Sync to Supabase Knowledge
        writeKnowledge("global", key, JSON.stringify(value), "hive-mind").catch(e => 
            log(`[hive] Failed to sync to Supabase: ${e.message}`, "warn")
        );
    }

    private saveState() {
        try {
            fs.writeFileSync(HIVE_PATH, JSON.stringify(this.state, null, 2));
        } catch (e: any) {
            log(`[hive] Failed to save state: ${e.message}`, "error");
        }
    }

    public getContextString(): string {
        return this.getSLayerContext("general");
    }

    /**
     * S-LAYER RETRIEVAL: Selective context injection.
     * Focuses on specific facts based on the current goal or task.
     */
    public getSLayerContext(focusArea: string): string {
        let ctx = "\n--- HIVE MIND SHARED STATE ---\n";
        ctx += `Mission: ${this.state.active_mission}\n`;
        ctx += `Focus: ${focusArea}\n`;
        
        // S-Layer Logic: Prioritize facts related to the focus area
        const facts = Object.entries(this.state.pinned_facts)
            .filter(([k]) => k.toLowerCase().includes(focusArea.toLowerCase()) || focusArea === "general")
            .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
            .join("\n");

        ctx += `Contextual Facts:\n${facts || "No relevant facts for this focus layer."}\n`;
        ctx += `Objectives:\n${this.state.objectives.map(o => `- ${o}`).join("\n")}\n`;
        ctx += "-------------------------------\n";
        return ctx;
    }
}
