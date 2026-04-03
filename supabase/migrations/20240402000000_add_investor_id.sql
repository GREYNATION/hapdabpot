-- Supabase Vector Memory Schema
-- Run this in Supabase SQL Editor

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing table if needed (optional)
-- DROP TABLE IF EXISTS memories;

-- Create memories table with agent and metadata columns
CREATE TABLE IF NOT EXISTS memories (
  id        BIGSERIAL PRIMARY KEY,
  user_id   TEXT NOT NULL,
  agent     TEXT,
  content   TEXT NOT NULL,
  embedding vector(1536),
  metadata  JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at);

-- Create or replace the match_memories function
CREATE OR REPLACE FUNCTION match_memories(
  query_embedding vector(1536),
  match_count     int DEFAULT 5,
  match_threshold float DEFAULT 0.7,
  p_user_id       text DEFAULT NULL
)
RETURNS TABLE (
  id         bigint,
  agent      text,
  content    text,
  similarity float,
  metadata   jsonb,
  created_at timestamptz
)
LANGUAGE sql STABLE AS $$
  SELECT 
    m.id,
    m.agent,
    m.content,
    1 - (m.embedding <=> query_embedding) AS similarity,
    m.metadata,
    m.created_at
  FROM memories m
  WHERE (p_user_id IS NULL OR m.user_id = p_user_id)
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Grant permissions (adjust as needed)
-- GRANT ALL ON memories TO service_role;
-- GRANT USAGE ON SEQUENCE memories_id_seq TO service_role;ALTER TABLE artists ADD COLUMN IF NOT EXISTS investor_id uuid REFERENCES auth.users(id);
