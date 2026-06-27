-- Stores the content calendar items; the Growth Agent reads this to know what to publish and when.
CREATE TABLE IF NOT EXISTS content_schedule (
  id           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel      TEXT NOT NULL,
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  error_msg    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_content_schedule_status ON content_schedule (status, scheduled_at);
