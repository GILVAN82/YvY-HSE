export interface ActionDeadlineState {
  status?: string | null;
  target_date?: string | Date | null;
}

/** Single application rule for deciding whether an action is overdue. */
export function isActionOverdue(action: ActionDeadlineState, now = new Date()): boolean {
  if (action.status === 'Closed' || !action.target_date) return false;
  const target = new Date(action.target_date);
  return !Number.isNaN(target.getTime()) && target < now;
}

/** SQL equivalent of isActionOverdue. Contains no user-controlled values. */
export const ACTION_OVERDUE_SQL =
  `status IS DISTINCT FROM 'Closed' AND target_date IS NOT NULL AND target_date < CURRENT_TIMESTAMP`;
