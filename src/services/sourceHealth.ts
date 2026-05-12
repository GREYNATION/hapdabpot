import { log } from "../core/config.js";

export interface SourceHealth {
  name: string;
  status: 'ONLINE' | 'DEGRADED' | 'BLOCKED' | 'OFFLINE';
  successRate: number;
  lastSuccess: Date | null;
  lastFailure: Date | null;
  consecutiveFailures: number;
  cooldownUntil: Date | null;
}

/**
 * Manages the health and success rates of various scraping sources.
 * Automatically handles cooldowns and rotation.
 */
class SourceHealthManager {
  private sources: Map<string, SourceHealth> = new Map();
  private readonly FAILURE_THRESHOLD = 3;
  private readonly COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours default

  constructor() {
    this.initDefaultSources();
  }

  private initDefaultSources() {
    const defaultSources = [
      'Brave Search',
      'Firecrawl',
      'Zillow Stealth',
      'Craigslist RSS',
      'Cuyahoga Sheriff',
      'Tavily'
    ];

    defaultSources.forEach(name => {
      this.sources.set(name, {
        name,
        status: 'ONLINE',
        successRate: 1.0,
        lastSuccess: null,
        lastFailure: null,
        consecutiveFailures: 0,
        cooldownUntil: null
      });
    });
  }

  public reportSuccess(sourceName: string) {
    const health = this.sources.get(sourceName);
    if (!health) return;

    health.lastSuccess = new Date();
    health.consecutiveFailures = 0;
    health.status = 'ONLINE';
    health.cooldownUntil = null;
    
    // Update success rate (moving average)
    health.successRate = (health.successRate * 0.9) + 0.1;
    
    this.sources.set(sourceName, health);
    log(`[health] Source ${sourceName} success reported. Success rate: ${(health.successRate * 100).toFixed(1)}%`);
  }

  public reportFailure(sourceName: string, error?: string) {
    const health = this.sources.get(sourceName);
    if (!health) return;

    health.lastFailure = new Date();
    health.consecutiveFailures++;
    
    // Update success rate
    health.successRate = (health.successRate * 0.9);

    if (health.consecutiveFailures >= this.FAILURE_THRESHOLD) {
      health.status = 'BLOCKED';
      health.cooldownUntil = new Date(Date.now() + this.COOLDOWN_MS);
      log(`[health] Source ${sourceName} BLOCKED due to ${health.consecutiveFailures} failures. Cooldown until ${health.cooldownUntil.toLocaleTimeString()}`, "warn");
    } else {
      health.status = 'DEGRADED';
      log(`[health] Source ${sourceName} DEGRADED (${health.consecutiveFailures}/${this.FAILURE_THRESHOLD} failures). Error: ${error || 'Unknown'}`, "warn");
    }

    this.sources.set(sourceName, health);
  }

  public isHealthy(sourceName: string): boolean {
    const health = this.sources.get(sourceName);
    if (!health) return true; // Assume unknown sources are fine

    if (health.cooldownUntil && health.cooldownUntil > new Date()) {
      return false;
    }

    if (health.status === 'BLOCKED' || health.status === 'OFFLINE') {
      return false;
    }

    return true;
  }

  public getStatusSummary(): string {
    let summary = "📊 **SOURCE HEALTH REPORT**\n\n";
    this.sources.forEach(h => {
      const icon = h.status === 'ONLINE' ? '✅' : h.status === 'BLOCKED' ? '🚫' : '⚠️';
      summary += `${icon} **${h.name}**: ${h.status}\n`;
      summary += `   Rate: ${(h.successRate * 100).toFixed(1)}% | Failures: ${h.consecutiveFailures}\n`;
      if (h.cooldownUntil && h.cooldownUntil > new Date()) {
        summary += `   Cooldown until: ${h.cooldownUntil.toLocaleTimeString()}\n`;
      }
      summary += "\n";
    });
    return summary;
  }
}

export const healthManager = new SourceHealthManager();
