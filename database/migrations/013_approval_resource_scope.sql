-- Legacy approvals remain unreadable/unresolvable until replaced with a scoped request.
ALTER TABLE agent_human_approval ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES app_user(id);
ALTER TABLE agent_human_approval ADD COLUMN IF NOT EXISTS scope_projects TEXT[];
CREATE INDEX IF NOT EXISTS agent_approval_owner_idx ON agent_human_approval(requested_by);
