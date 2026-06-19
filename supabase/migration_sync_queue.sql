-- =============================================
-- Migration: Resumable Chunked Sync Architecture
-- Run this in Supabase SQL Editor AFTER schema.sql
-- =============================================

-- =============================================
-- Sync Queue Table — stores discovered message IDs
-- =============================================
CREATE TABLE IF NOT EXISTS sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gmail_id TEXT NOT NULL,
  thread_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, gmail_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_user_status ON sync_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_user_pending ON sync_queue(user_id) WHERE status = 'pending';

-- =============================================
-- Update sync_status table with new columns
-- =============================================
ALTER TABLE sync_status ADD COLUMN IF NOT EXISTS phase TEXT DEFAULT 'idle'
  CHECK (phase IN ('idle', 'enumerating', 'hydrating', 'categorizing', 'embedding', 'complete', 'error'));
ALTER TABLE sync_status ADD COLUMN IF NOT EXISTS total_discovered INTEGER DEFAULT 0;
ALTER TABLE sync_status ADD COLUMN IF NOT EXISTS total_hydrated INTEGER DEFAULT 0;
ALTER TABLE sync_status ADD COLUMN IF NOT EXISTS total_errors INTEGER DEFAULT 0;
ALTER TABLE sync_status ADD COLUMN IF NOT EXISTS last_page_token TEXT;
ALTER TABLE sync_status ADD COLUMN IF NOT EXISTS enumeration_done BOOLEAN DEFAULT FALSE;

-- RLS policy for sync_queue
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on sync_queue" ON sync_queue FOR ALL USING (true) WITH CHECK (true);
