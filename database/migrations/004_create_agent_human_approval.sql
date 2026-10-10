CREATE TABLE IF NOT EXISTS agent_human_approval (
  id UUID PRIMARY KEY,
  thread_id UUID NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('LOTO_SAFETY_EXECUTION')),
  summary TEXT NOT NULL CHECK (length(summary) BETWEEN 1 AND 300),
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
  risk_level TEXT NOT NULL CHECK (risk_level = 'CRITICAL'),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT CHECK (resolution_note IS NULL OR length(resolution_note) <= 500),
  CHECK ((status = 'PENDING' AND resolved_at IS NULL) OR (status <> 'PENDING' AND resolved_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS agent_human_approval_thread_status_idx
  ON agent_human_approval (thread_id, status, created_at DESC);

COMMENT ON TABLE agent_human_approval IS
  'Prototype HITL audit trail. No approver identity is recorded because authentication is absent.';
