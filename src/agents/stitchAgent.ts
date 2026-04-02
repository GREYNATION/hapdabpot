import { BaseAgent } from "./baseAgent.js";
import { config } from "../core/config.js";

/**
 * StitchAgent manages the persistent "Master Factory" project in Stitch.
 * It handles scaffolding, template instantiation, and design token application.
 */
export class StitchAgent extends BaseAgent {
    private masterProjectId: string | null = config.STITCH_MASTER_PROJECT_ID || null;

    constructor() {
        super("Stitch", "You are the Stitch Agent. You manage the Master Factory Design OS. You translate blueprints into visual screens, map components, and apply design systems.");
    }

    getName(): string {
        return "Stitch";
    }

    getSystemPrompt(): string {
        return "You are the Stitch Agent. You manage the Master Factory Design OS. Your goal is to maintain a high-quality visual library and instantiate templates for new builds exactly as specified in the SiteBlueprint.";
    }

    /**
     * Ensures the Master Factory project exists and is stored in config.
     */
    async ensureMasterProject(): Promise<string> {
        if (this.masterProjectId) return this.masterProjectId;

        // Logic to create or find project would go here
        // For now, we will use the ID from the first initialization
        throw new Error("STITCH_MASTER_PROJECT_ID not found in config.");
    }
}

export const stitchAgent = new StitchAgent();
