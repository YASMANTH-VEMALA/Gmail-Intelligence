-- =============================================
-- Gmail Intelligence Platform — Supabase Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================
-- Users Table
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  picture TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- =============================================
-- Emails Table
-- =============================================
CREATE TABLE IF NOT EXISTS emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gmail_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  subject TEXT,
  from_address TEXT,
  from_name TEXT,
  to_addresses TEXT[] DEFAULT '{}',
  cc_addresses TEXT[] DEFAULT '{}',
  bcc_addresses TEXT[] DEFAULT '{}',
  date TIMESTAMPTZ,
  snippet TEXT,
  body_text TEXT,
  body_html TEXT,
  labels TEXT[] DEFAULT '{}',
  is_read BOOLEAN DEFAULT TRUE,
  is_starred BOOLEAN DEFAULT FALSE,
  has_attachments BOOLEAN DEFAULT FALSE,
  in_reply_to TEXT,
  "references" TEXT[] DEFAULT '{}',
  headers JSONB DEFAULT '{}',
  summary TEXT,
  category TEXT CHECK (category IN ('newsletters', 'job_recruitment', 'finance', 'notifications', 'personal', 'work_professional', 'uncategorized')),
  embedding vector(768),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, gmail_id)
);

CREATE INDEX idx_emails_user_id ON emails(user_id);
CREATE INDEX idx_emails_thread_id ON emails(user_id, thread_id);
CREATE INDEX idx_emails_date ON emails(user_id, date DESC);
CREATE INDEX idx_emails_category ON emails(user_id, category);
CREATE INDEX idx_emails_from ON emails(user_id, from_address);
CREATE INDEX idx_emails_subject ON emails USING gin(subject gin_trgm_ops);


-- Vector similarity index (IVFFlat for performance)
CREATE INDEX idx_emails_embedding ON emails
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- =============================================
-- Threads Table
-- =============================================
CREATE TABLE IF NOT EXISTS threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gmail_thread_id TEXT NOT NULL,
  subject TEXT,
  participants TEXT[] DEFAULT '{}',
  message_count INTEGER DEFAULT 0,
  last_message_date TIMESTAMPTZ,
  snippet TEXT,
  labels TEXT[] DEFAULT '{}',
  summary TEXT,
  category TEXT CHECK (category IN ('newsletters', 'job_recruitment', 'finance', 'notifications', 'personal', 'work_professional', 'uncategorized')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, gmail_thread_id)
);

CREATE INDEX idx_threads_user_id ON threads(user_id);
CREATE INDEX idx_threads_date ON threads(user_id, last_message_date DESC);
CREATE INDEX idx_threads_category ON threads(user_id, category);

-- =============================================
-- Sync Status Table
-- =============================================
CREATE TABLE IF NOT EXISTS sync_status (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_sync_at TIMESTAMPTZ,
  last_history_id TEXT,
  total_messages_synced INTEGER DEFAULT 0,
  sync_in_progress BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Vector Search Function (for RAG)
-- =============================================
CREATE OR REPLACE FUNCTION match_emails(
  query_embedding vector(768),
  match_threshold FLOAT,
  match_count INT,
  p_user_id UUID
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  gmail_id TEXT,
  thread_id TEXT,
  subject TEXT,
  from_address TEXT,
  from_name TEXT,
  to_addresses TEXT[],
  cc_addresses TEXT[],
  bcc_addresses TEXT[],
  date TIMESTAMPTZ,
  snippet TEXT,
  body_text TEXT,
  body_html TEXT,
  labels TEXT[],
  is_read BOOLEAN,
  is_starred BOOLEAN,
  has_attachments BOOLEAN,
  in_reply_to TEXT,
  "references" TEXT[],
  headers JSONB,
  summary TEXT,
  category TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id, e.user_id, e.gmail_id, e.thread_id, e.subject,
    e.from_address, e.from_name, e.to_addresses, e.cc_addresses,
    e.bcc_addresses, e.date, e.snippet, e.body_text, e.body_html,
    e.labels, e.is_read, e.is_starred, e.has_attachments,
    e.in_reply_to, e."references", e.headers, e.summary, e.category,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM emails e
  WHERE e.user_id = p_user_id
    AND e.embedding IS NOT NULL
    AND 1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =============================================
-- Row Level Security (RLS)
-- =============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;

-- Service role can access everything (for backend)
CREATE POLICY "Service role full access on users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on emails" ON emails FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on threads" ON threads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on sync_status" ON sync_status FOR ALL USING (true) WITH CHECK (true);
