import { ArchitectAgent, SiteBlueprint } from "../agents/architectAgent.js";
import { StitchAgent } from "../agents/stitchAgent.js";
import { MarketerAgent } from "../agents/marketerAgent.js";
import { developerAgent } from "../agents/developer.js";
import { log } from "../core/config.js";
import { DashboardPatch, FactoryDashboardState, DashboardStage, DashboardStatus } from "../core/factoryTypes.js";

export type FactoryStatus = "PLANNING" | "SCAFFOLDING" | "STYLING" | "CONTENT" | "ASSEMBLY" | "COMPLETE" | "FAILED";

/**
 * WebsiteFactory is the central state machine orchestrator for the production assembly line.
 */
export class WebsiteFactory {
    private architect = new ArchitectAgent();
    private stitch = new StitchAgent();
    private marketer = new MarketerAgent();

    async build(prompt: string, onProgress?: (patch: DashboardPatch) => void) {
        const buildId = `wf_${Math.random().toString(36).substr(2, 5)}`;
        
        // INITIAL STATE
        const dashboard: FactoryDashboardState = {
            id: buildId,
            status: "planning",
            stages: {
                architect: { status: "pending" },
                stitch: { status: "pending" },
                marketing: { status: "pending" },
                developer: { status: "pending" },
                deploy: { status: "pending" },
            },
            timestamps: {
                startedAt: Date.now(),
                updatedAt: Date.now(),
            },
            logs: []
        };

        const patch = (stage: DashboardStage, status: DashboardStatus, message?: string, overallStatus?: "complete" | "failed") => {
            dashboard.stages[stage].status = status;
            if (message) dashboard.stages[stage].message = message;
            dashboard.timestamps.updatedAt = Date.now();
            if (message) dashboard.logs.push(`[${stage.toUpperCase()}] ${message}`);
            
            if (overallStatus) {
                dashboard.status = overallStatus;
                if (overallStatus === "complete") dashboard.timestamps.finishedAt = Date.now();
            }

            if (onProgress) onProgress({ stage, status, message, overallStatus });
        };

        let blueprint: SiteBlueprint;
        let uiData: any;
        let copy: any;

        try {
            // 1. STATE: ARCHITECT
            log("[Factory] State: ARCHITECT");
            patch("architect", "running", "Designing blueprint...");
            const planResponse = await this.architect.ask(prompt);
            blueprint = Object.freeze(JSON.parse(planResponse.content || "{}"));

            // VALIDATION GUARD
            if (!this.marketer.isValidBlueprint(blueprint)) {
                patch("architect", "failed", "Invalid Blueprint structure.");
                throw new Error("Architect failed to produce a valid SiteBlueprint JSON.");
            }
            patch("architect", "complete", `Blueprint: ${blueprint.templateId}`);

            // 2. STATE: STITCH
            patch("stitch", "running", "Assembling UI in Stitch...");
            await this.stitch.ensureMasterProject();
            uiData = Object.freeze({ status: "scaffolded", screens: blueprint.pages }); 
            patch("stitch", "complete", "UI Layout assembled.");

            // 3. STATE: MARKETING
            patch("marketing", "running", "Generating copy and brand voice...");
            const copyResponse = await this.marketer.ask(JSON.stringify({
                pages: blueprint.pages,
                components: blueprint.components,
                goal: blueprint.goal
            }));
            copy = Object.freeze(JSON.parse(copyResponse.content || "{}"));
            patch("marketing", "complete", "Brand voice ready.");

            // 4. STATE: DEVELOPER
            patch("developer", "running", "Compiling code bundle...");
            const finalCode = await developerAgent(uiData, copy, blueprint);
            patch("developer", "complete", `${finalCode.files.length} files compiled.`);

            // 5. STATE: DEPLOY
            patch("deploy", "running", "Finalizing deployment pipeline...");
            // FUTURE: Add Vercel/Netlify logic
            patch("deploy", "complete", "Deployment successful!", "complete");

            return {
                blueprint,
                copy,
                code: finalCode,
                dashboard
            };

        } catch (error: any) {
            log(`[Factory] Build FAILED: ${error.message}`, "error");
            // Find the currently running stage and mark it failed
            const currentStage = (Object.keys(dashboard.stages) as DashboardStage[]).find(s => dashboard.stages[s].status === "running");
            patch(currentStage || "deploy", "failed", error.message, "failed");
            throw error;
        }
    }
}

export const websiteFactory = new WebsiteFactory();
