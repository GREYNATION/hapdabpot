import { spawn } from 'child_process';
import path from 'path';
import { log } from '../../core/config.js';

export interface TradingSwarmResult {
    symbol: string;
    decision: string;
    analyst_reports?: Record<string, string>;
    investment_plan?: string;
    risk_assessment?: string;
    error?: string;
}

export class TradingSwarmAgent {
    private static bridgePath = path.resolve(process.cwd(), 'TradingAgents', 'bridge.py');
    private static repoPath = path.resolve(process.cwd(), 'TradingAgents');

    /**
     * Executes the Python Trading Swarm for a specific symbol
     */
    static async analyze(symbol: string): Promise<TradingSwarmResult> {
        return new Promise((resolve, reject) => {
            log(`[TradingSwarm] Initializing swarm analysis for ${symbol}...`);
            
            const pythonProcess = spawn('python', [this.bridgePath, symbol], {
                cwd: this.repoPath,
                env: { ...process.env, PYTHONPATH: this.repoPath }
            });

            let stdout = '';
            let stderr = '';

            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    log(`[TradingSwarm] Python process failed with code ${code}: ${stderr}`, "error");
                    return resolve({ symbol, decision: "ERROR", error: stderr || `Process exited with code ${code}` });
                }

                try {
                    // Find the JSON block in stdout (in case of debug prints)
                    const jsonMatch = stdout.match(/\{.*\}/s);
                    if (!jsonMatch) {
                        return resolve({ symbol, decision: "ERROR", error: "No valid JSON output from bridge" });
                    }
                    const result = JSON.parse(jsonMatch[0]);
                    resolve(result);
                } catch (err: any) {
                    log(`[TradingSwarm] Failed to parse bridge output: ${err.message}`, "error");
                    resolve({ symbol, decision: "ERROR", error: err.message });
                }
            });
        });
    }

    /**
     * Formats the swarm results into a readable report
     */
    static formatReport(result: TradingSwarmResult): string {
        if (result.error) {
            return `❌ **Trading Swarm Error**\n\n${result.error}`;
        }

        let report = `🦅 **Trading Swarm Intel: ${result.symbol}**\n\n`;
        report += `🎯 **Final Decision**: ${result.decision}\n\n`;
        
        if (result.investment_plan) {
            report += `📝 **Investment Plan**:\n${result.investment_plan}\n\n`;
        }

        if (result.risk_assessment) {
            report += `⚖️ **Risk Assessment**:\n${result.risk_assessment}\n\n`;
        }

        if (result.analyst_reports) {
            report += `📊 **Analyst Consensus**:\n`;
            for (const [analyst, summary] of Object.entries(result.analyst_reports)) {
                const name = analyst.replace(/_/g, ' ').toUpperCase();
                report += `• **${name}**: ${summary.slice(0, 200)}...\n`;
            }
        }

        return report;
    }
}
