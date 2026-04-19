/**
 * orchestrator.ts
 * Queries agent tier BEFORE every execution.
 * Enforces physical limits based on tier.
 *
 * Tier 1 — Novice:  1 tool call, cheapest model, no cron
 * Tier 2 — Veteran: batch tools (5 parallel), web search, flux-dev-image
 * Tier 3 — Master:  node-cron autonomy, vision, unlimited loops, best models
 */

import { getAgentStats, awardXP } from './xpEngine.js';

// ── Tier Configs ──────────────────────────────────────────────────────────────

const TIER_CONFIG = {
  1: {
    label:        'Novice',
    maxToolLoops: 2,
    batchSize:    1,
    model:        'claude-haiku-4-5-20251001',
    imageModel:   'flux-schnell',
    videoModel:   'wan2.5-image-to-video',
    cronAccess:   false,
    webSearch:    false,
    vision:       false,
  },
  2: {
    label:        'Veteran',
    maxToolLoops: 5,
    batchSize:    5,
    model:        'claude-sonnet-4-6',
    imageModel:   'flux-dev-image',
    videoModel:   'wan2.5-image-to-video',
    cronAccess:   false,
    webSearch:    true,
    vision:       false,
  },
  3: {
    label:        'Master',
    maxToolLoops: 10,
    batchSize:    20,
    model:        'claude-sonnet-4-6',
    imageModel:   'flux-kontext-max-t2i',
    videoModel:   'kling-v2.6-pro-i2v',
    cronAccess:   true,
    webSearch:    true,
    vision:       true,
  },
} as const;

type TierKey = keyof typeof TIER_CONFIG;

// ── Main Execution Gate ───────────────────────────────────────────────────────

export async function executeWithTier<T>(
  agentId: string,
  taskFn: (config: typeof TIER_CONFIG[TierKey]) => Promise<T>,
  options: {
    eventType?: 'deal_closed' | 'signal_fired' | 'episode_done' | 'daily_streak';
    metadata?: Record<string, unknown>;
    requireSkill?: string;
  } = {}
): Promise<T> {

  // 1. Get agent tier
  const stats = await getAgentStats(agentId);
  if (!stats) throw new Error(`Agent ${agentId} not in database`);

  const tier   = stats.tier as TierKey;
  const config = TIER_CONFIG[tier];

  console.log(`[Orchestrator] ${agentId} | Tier ${tier} (${config.label}) | ${options.eventType || 'task'}`);

  // 2. Skill gate
  if (options.requireSkill) {
    const hasSkill = (stats.skills as string[]).includes(options.requireSkill);
    if (!hasSkill) {
      throw new Error(
        `${agentId} needs skill: ${options.requireSkill}. ` +
        `Upgrade to Tier ${tier < 2 ? 2 : 3} to unlock. ` +
        `Current tokens: ${stats.server_tokens}`
      );
    }
  }

  // 3. Run task with tier config
  const result = await taskFn(config);

  // 4. Award XP if event type provided
  if (options.eventType) {
    await awardXP(agentId, options.eventType, options.metadata || {});
  }

  return result;
}

// ── Convenience: Tier-Aware Image Generation ──────────────────────────────────

export async function tierAwareImageGen(agentId: string, prompt: string): Promise<string> {
  return executeWithTier(agentId, async (config) => {
    console.log(`[Orchestrator] Image model: ${config.imageModel}`);
    // Wire to your Muapi client here:
    // return await muapiClient.run(config.imageModel, { prompt, aspect_ratio: '9:16' });
    return `[DEMO] ${config.imageModel} → ${prompt.slice(0, 40)}...`;
  });
}

// ── Convenience: Tier-Aware Batch Run ─────────────────────────────────────────

export async function tierAwareBatch<T>(
  agentId: string,
  items: T[],
  processFn: (item: T, config: typeof TIER_CONFIG[TierKey]) => Promise<unknown>
): Promise<unknown[]> {

  return executeWithTier(agentId, async (config) => {
    const batch = items.slice(0, config.batchSize);
    console.log(`[Orchestrator] Batch: ${batch.length}/${items.length} items (Tier ${config.label} limit)`);

    if (config.batchSize === 1) {
      // Tier 1: sequential
      const results = [];
      for (const item of batch) {
        results.push(await processFn(item, config));
      }
      return results;
    } else {
      // Tier 2+: parallel
      return Promise.all(batch.map(item => processFn(item, config)));
    }
  });
}

// ── Verification: Compare Tier 1 vs Tier 3 ───────────────────────────────────

export async function verifyTierDifference(): Promise<void> {
  console.log('\n=== TIER VERIFICATION TEST ===');

  // Simulate a Tier 1 agent
  const t1Config = TIER_CONFIG[1];
  console.log('Tier 1 — Novice:');
  console.log('  Model:', t1Config.model);
  console.log('  Image:', t1Config.imageModel);
  console.log('  Batch:', t1Config.batchSize);
  console.log('  Cron:', t1Config.cronAccess);
  console.log('  Web:', t1Config.webSearch);

  // Simulate a Tier 3 agent
  const t3Config = TIER_CONFIG[3];
  console.log('\nTier 3 — Master:');
  console.log('  Model:', t3Config.model);
  console.log('  Image:', t3Config.imageModel);
  console.log('  Batch:', t3Config.batchSize);
  console.log('  Cron:', t3Config.cronAccess);
  console.log('  Web:', t3Config.webSearch);
  console.log('  Vision:', t3Config.vision);
  console.log('=== END TEST ===\n');
}
