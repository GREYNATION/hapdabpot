/**
 * xpEngine.ts
 * Mints XP and Server Tokens from real hapdabot events.
 *
 * Token Sources:
 *   deal_closed   → +500 XP  +5 tokens
 *   signal_fired  → +50 XP   +1 token (per confirmed signal)
 *   episode_done  → +300 XP  +3 tokens
 *   daily_streak  → +100 XP  +1 token
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL=https://yvjelzhzuhtxiyfrnzlm.supabase.co
  process.env.SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2amVsemh6dWh0eGl5ZnJuemxtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA3Nzc2MSwiZXhwIjoyMDg4NjUzNzYxfQ.vVgNTTxGjaWloe_LfvBSxjfs_5oQ3psjYEFMOj9JCH4
);

// ── XP tables per event type ──────────────────────────────────────────────────

const XP_TABLE: Record<string, { xp: number; tokens: number }> = {
  deal_closed:   { xp: 500, tokens: 5 },
  signal_fired:  { xp: 50,  tokens: 1 },
  episode_done:  { xp: 300, tokens: 3 },
  daily_streak:  { xp: 100, tokens: 1 },
};

// ── Tier upgrade costs (tokens) ──────────────────────────────────────────────

export const TIER_COSTS: Record<string, number> = {
  '1->2': 10,
  '2->3': 25,
};

// ── Tier skill unlocks ────────────────────────────────────────────────────────

export const TIER_SKILLS: Record<number, string[]> = {
  1: [],
  2: ['BATCH_PROCESSING', 'WEB_SEARCH', 'FLUX_DEV_IMAGE'],
  3: ['CRON_AUTONOMY', 'VISION_ANALYSIS', 'ADVANCED_MODELS', 'PARALLEL_TOOLS'],
};

// ── Core: Award XP ────────────────────────────────────────────────────────────

export async function awardXP(
  agentId: string,
  eventType: keyof typeof XP_TABLE,
  metadata: Record<string, unknown> = {}
): Promise<{ newXp: number; newLevel: number; newTokens: number; leveledUp: boolean }> {

  const reward = XP_TABLE[eventType];
  if (!reward) throw new Error(`Unknown event type: ${eventType}`);

  // Get current stats
  const { data: agent, error } = await supabase
    .from('agent_stats')
    .select('*')
    .eq('agent_id', agentId)
    .single();

  if (error || !agent) throw new Error(`Agent not found: ${agentId}`);

  const newXp     = agent.xp + reward.xp;
  const newTokens = agent.server_tokens + reward.tokens;
  const newLevel  = Math.floor(newXp / 100) + 1;
  const leveledUp = newLevel > agent.level;

  // Update agent stats
  await supabase.from('agent_stats').update({
    xp:           newXp,
    level:        newLevel,
    server_tokens: newTokens,
    xp_to_next:   (newLevel * 100) - newXp,
    total_tasks:  agent.total_tasks + 1,
    last_active:  new Date().toISOString(),
  }).eq('agent_id', agentId);

  // Log the event
  await supabase.from('xp_events').insert({
    agent_id:      agentId,
    event_type:    eventType,
    xp_earned:     reward.xp,
    tokens_earned: reward.tokens,
    metadata,
  });

  console.log(`[XP] ${agentId} +${reward.xp}XP +${reward.tokens}T (${eventType})`);
  if (leveledUp) console.log(`[XP] ${agentId} LEVEL UP -> ${newLevel}`);

  return { newXp, newLevel, newTokens, leveledUp };
}

// ── Spend Tokens to Upgrade Tier ─────────────────────────────────────────────

export async function upgradeTier(agentId: string): Promise<{
  success: boolean;
  newTier?: number;
  tokensSpent?: number;
  error?: string;
}> {

  const { data: agent } = await supabase
    .from('agent_stats')
    .select('*')
    .eq('agent_id', agentId)
    .single();

  if (!agent) return { success: false, error: 'Agent not found' };
  if (agent.tier >= 3) return { success: false, error: 'Already at max tier (Master)' };

  const costKey  = `${agent.tier}->${agent.tier + 1}`;
  const cost     = TIER_COSTS[costKey];
  const newTier  = agent.tier + 1;

  if (agent.server_tokens < cost) {
    return {
      success: false,
      error: `Need ${cost} tokens, have ${agent.server_tokens}. Need ${cost - agent.server_tokens} more.`
    };
  }

  const newSkills = [
    ...(agent.skills || []),
    ...TIER_SKILLS[newTier]
  ];

  // Apply upgrade
  await supabase.from('agent_stats').update({
    tier:          newTier,
    server_tokens: agent.server_tokens - cost,
    skills:        newSkills,
  }).eq('agent_id', agentId);

  // Log upgrade
  await supabase.from('tier_upgrades').insert({
    agent_id:    agentId,
    from_tier:   agent.tier,
    to_tier:     newTier,
    tokens_spent: cost,
  });

  console.log(`[TIER] ${agentId} upgraded ${agent.tier} -> ${newTier} (cost: ${cost}T)`);
  return { success: true, newTier, tokensSpent: cost };
}

// ── Daily Streak Check ────────────────────────────────────────────────────────

export async function checkDailyStreak(agentId: string): Promise<void> {
  const { data: agent } = await supabase
    .from('agent_stats')
    .select('last_active, streak_days')
    .eq('agent_id', agentId)
    .single();

  if (!agent) return;

  const lastActive = new Date(agent.last_active);
  const now        = new Date();
  const hoursSince = (now.getTime() - lastActive.getTime()) / 3600000;

  if (hoursSince >= 20 && hoursSince < 48) {
    // Active yesterday — streak continues
    await supabase.from('agent_stats')
      .update({ streak_days: agent.streak_days + 1 })
      .eq('agent_id', agentId);
    await awardXP(agentId, 'daily_streak', { streak: agent.streak_days + 1 });
  } else if (hoursSince >= 48) {
    // Streak broken
    await supabase.from('agent_stats')
      .update({ streak_days: 0 })
      .eq('agent_id', agentId);
  }
}

// ── Get All Agent Stats (for dashboard) ──────────────────────────────────────

export async function getAllStats() {
  const { data } = await supabase
    .from('agent_stats')
    .select('*')
    .order('tier', { ascending: false })
    .order('xp', { ascending: false });
  return data || [];
}

export async function getAgentStats(agentId: string) {
  const { data } = await supabase
    .from('agent_stats')
    .select('*')
    .eq('agent_id', agentId)
    .single();
  return data;
}

