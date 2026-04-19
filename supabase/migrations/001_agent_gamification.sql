-- Agent Gamification Schema
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS agent_stats (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        text UNIQUE NOT NULL,
  display_name    text NOT NULL,
  tier            integer NOT NULL DEFAULT 1 CHECK (tier BETWEEN 1 AND 3),
  level           integer NOT NULL DEFAULT 1,
  xp              integer NOT NULL DEFAULT 0,
  xp_to_next      integer NOT NULL DEFAULT 100,
  server_tokens   integer NOT NULL DEFAULT 0,
  skills          jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_tasks     integer NOT NULL DEFAULT 0,
  streak_days     integer NOT NULL DEFAULT 0,
  last_active     timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- XP event log (audit trail)
CREATE TABLE IF NOT EXISTS xp_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    text NOT NULL REFERENCES agent_stats(agent_id),
  event_type  text NOT NULL,  -- 'deal_closed' | 'signal_fired' | 'episode_done' | 'daily_streak'
  xp_earned   integer NOT NULL,
  tokens_earned integer NOT NULL DEFAULT 0,
  metadata    jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz DEFAULT now()
);

-- Upgrade log
CREATE TABLE IF NOT EXISTS tier_upgrades (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        text NOT NULL REFERENCES agent_stats(agent_id),
  from_tier       integer NOT NULL,
  to_tier         integer NOT NULL,
  tokens_spent    integer NOT NULL,
  approved_by     text DEFAULT 'hap',
  created_at      timestamptz DEFAULT now()
);

-- Seed all 8 hapdabot agents
INSERT INTO agent_stats (agent_id, display_name, tier, xp, server_tokens, skills) VALUES
  ('orchestrator',  'Orchestrator',   1, 0, 0, '[]'),
  ('claude_client', 'Claude Client',  1, 0, 0, '[]'),
  ('real_estate',   'Real Estate',    1, 0, 0, '[]'),
  ('trader',        'Master Trader',  1, 0, 0, '[]'),
  ('content',       'Content',        1, 0, 0, '[]'),
  ('cinema',        'Cinema',         1, 0, 0, '[]'),
  ('researcher',    'Researcher',     1, 0, 0, '[]'),
  ('github',        'GitHub',         1, 0, 0, '[]')
ON CONFLICT (agent_id) DO NOTHING;

-- Tier upgrade costs (tokens required)
-- Tier 1->2: 10 tokens | Tier 2->3: 25 tokens

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER agent_stats_updated
  BEFORE UPDATE ON agent_stats
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();
