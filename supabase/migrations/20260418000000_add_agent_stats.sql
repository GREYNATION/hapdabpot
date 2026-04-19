CREATE TABLE IF NOT EXISTS public.agent_stats (
    agent_id text PRIMARY KEY,
    level integer DEFAULT 1,
    current_xp integer DEFAULT 0,
    api_calls_used integer DEFAULT 0,
    success_rate numeric DEFAULT 100.0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Seed initial agents
INSERT INTO public.agent_stats (agent_id) VALUES 
('hapda'), ('rex'), ('surplus'), ('aria'), ('stuyza'), ('phantom'), ('prophet')
ON CONFLICT (agent_id) DO NOTHING;
