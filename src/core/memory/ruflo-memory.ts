import { exec } from "child_process";
import { promisify } from "util";
import { log } from "../config.js";

const execAsync = promisify(exec);

/**
 * RufloMemoryFramework
 * Wrapper around the `claude-flow` package for swarm memory and vector storage.
 */
export class RufloMemoryFramework {
    private isInitialized = false;

    constructor() {}

    async initialize() {
        try {
            log("🧠 Ruflo Memory Framework Initializing...");
            // Initialize the local ruflo instance
            await execAsync("npx -y claude-flow@latest hive-mind init").catch(e => log(`Init warning (may already be initialized): ${e.message}`));
            this.isInitialized = true;
            log("🧠 Ruflo Vector Memory connected to Swarm. Ready for 60+ agents.");
        } catch (err: any) {
            log(`❌ Failed to initialize Ruflo Memory: ${err.message}`, "error");
        }
    }

    async saveContext(taskId: string, data: any) {
        if (!this.isInitialized) await this.initialize();
        log(`💾 [Ruflo Memory] Saving context for task: ${taskId}`);
        try {
            await execAsync(`npx -y claude-flow@latest memory_store "${taskId}" "${data}"`);
        } catch (e) {
            log(`Memory store warning: ${e}`);
        }
        return true;
    }

    async retrieveContext(query: string) {
        if (!this.isInitialized) await this.initialize();
        log(`🔍 [Ruflo Memory] Searching vector space for: ${query}`);
        try {
            const { stdout } = await execAsync(`npx -y claude-flow@latest memory_search "${query}"`);
            return { results: stdout };
        } catch (e) {
            return { results: [] };
        }
    }

    /**
     * Deploys a swarm of agents to solve a complex task using the memory framework.
     */
    async deploySwarm(task: string, swarmType: "youtube" | "general" = "general") {
        if (!this.isInitialized) await this.initialize();
        log(`🐝 [Ruflo Swarm] Deploying 60+ agent swarm for: ${swarmType}`);
        
        try {
            if (swarmType === "youtube") {
                log(`🎬 [Ruflo Youtube Tunnel] Activating Scriptwriters, SEO Experts, and Editors...`);
                // Spawn the swarm using the local CLI entry point
                const command = `npx -y claude-flow@latest hive-mind spawn "Execute YouTube Tunnel: Write script, generate SEO tags, and prepare shot list for: ${task}"`;
                log(`🚀 Running command: ${command}`);
                
                const { stdout, stderr } = await execAsync(command);
                log(`✅ YouTube Tunnel Swarm Output:\n${stdout}`);
                
                return `✅ YouTube Tunnel Swarm successfully processed task: "${task}".\n\n**Output Preview:**\n${stdout.substring(0, 1000)}...`;
            }

            // General swarm
            const command = `npx -y claude-flow@latest hive-mind spawn "${task}"`;
            log(`🚀 Running command: ${command}`);
            const { stdout } = await execAsync(command);
            
            return `✅ General Swarm successfully processed task: "${task}"\n\n**Output:**\n${stdout.substring(0, 1000)}...`;
        } catch (error: any) {
            log(`❌ Swarm deployment failed: ${error.message}`, "error");
            return `❌ Swarm deployment failed: ${error.message}`;
        }
    }
}

export const rufloEngine = new RufloMemoryFramework();
