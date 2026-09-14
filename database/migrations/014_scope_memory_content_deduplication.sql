-- Preserve rows and key semantics. Serialize the audit and index replacement
-- against writers; the migration runner wraps this file in one transaction.
LOCK TABLE agent_long_term_memory IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM agent_long_term_memory WHERE enabled
    GROUP BY user_id, category, content_hash HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Memory deduplication migration refused: duplicate active memories require review';
  END IF;
END $$;

CREATE UNIQUE INDEX agent_memory_user_content_hash_idx
  ON agent_long_term_memory (user_id, category, content_hash)
  WHERE enabled AND user_id IS NOT NULL;

-- Unowned historical rows remain inaccessible through user-scoped repositories.
-- Keep their existing deduplication without blocking any authenticated user.
CREATE UNIQUE INDEX agent_memory_unowned_content_hash_idx
  ON agent_long_term_memory (category, content_hash)
  WHERE enabled AND user_id IS NULL;

DROP INDEX IF EXISTS agent_long_term_memory_active_hash_idx;
