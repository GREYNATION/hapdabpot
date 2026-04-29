import { BaseAgent } from '../baseAgent.js';
import { spawn } from 'child_process';
import path from 'path';
import { log } from '../../core/config.js';

export interface GeneticsProgress {
    generation: number;
    fitness: number;
}

export class GeneticTraderAgent extends BaseAgent {
    private isRunning: boolean = false;
    private currentProgress: GeneticsProgress | null = null;

    constructor() {
        super("Genetics Trader", "You are the Genetics Trader Agent. You specialize in strategy evolution using genetic algorithms.");
    }

    public getSystemPrompt(): string {
        return "You are the Genetics Trader Agent. You specialize in strategy evolution using genetic algorithms.";
    }

    public getSkills(): any[] {
        return [];
    }

    public getName(): string {
        return "Genetics Trader";
    }

    public async runEvolution(): Promise<void> {
        if (this.isRunning) {
            log("[GeneticsTrader] Evolution is already running.", "warn");
            return;
        }

        this.isRunning = true;
        const scriptPath = path.resolve('src/agents/trading/genetics_core.py');
        
        // Determine Python executable (check for venv)
        const venvPath = process.platform === 'win32' 
            ? path.resolve('.venv', 'Scripts', 'python.exe')
            : path.resolve('.venv', 'bin', 'python');
        
        const pythonExec = require('fs').existsSync(venvPath) ? venvPath : 'python';

        log(`[GeneticsTrader] Starting evolution process: ${scriptPath} using ${pythonExec}`);

        const pythonProcess = spawn(pythonExec, [scriptPath, '--run']);

        pythonProcess.stdout.on('data', (data) => {
            const output = data.toString();
            try {
                // Expecting JSON lines from the Python script
                const lines = output.split('\n');
                for (const line of lines) {
                    if (line.trim() && line.startsWith('{')) {
                        const message = JSON.parse(line);
                        if (message.type === 'progress') {
                            this.currentProgress = message.data;
                            log(`[GeneticsTrader] Generation ${this.currentProgress?.generation}: Fitness ${this.currentProgress?.fitness.toFixed(4)}`);
                        }
                    }
                }
            } catch (e: any) {
                // Ignore non-JSON output
            }
        });

        pythonProcess.stderr.on('data', (data) => {
            log(`[GeneticsTrader] Error: ${data}`, "error");
        });

        pythonProcess.on('close', (code) => {
            this.isRunning = false;
            log(`[GeneticsTrader] Evolution finished with code ${code}`);
        });
    }

    public getStatus(): string {
        if (this.isRunning) {
            return `Running: Generation ${this.currentProgress?.generation || 0}, Best Fitness ${this.currentProgress?.fitness || 0}`;
        }
        return "Idle";
    }

    public async ask(query: string): Promise<{ content: string }> {
        if (query.toLowerCase().includes("status")) {
            return { content: `**[Genetics Trader]**: Current status: ${this.getStatus()}` };
        }
        
        if (query.toLowerCase().includes("run") || query.toLowerCase().includes("start")) {
            this.runEvolution();
            return { content: "**[Genetics Trader]**: Evolution process initiated. I will notify you of significant progress." };
        }

        return { content: "**[Genetics Trader]**: I am the evolution engine. You can ask me to 'run' a new strategy evolution or check the 'status'." };
    }
}
