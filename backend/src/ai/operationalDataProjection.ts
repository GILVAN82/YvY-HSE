export const ACTION_MODEL_VISIBLE_FIELDS = [
  'actionId',
  'description',
  'status',
  'targetDate',
  'daysOverdue',
  'priority',
  'sourceModule',
] as const;

export type SafeActionModelProjection = {
  [K in (typeof ACTION_MODEL_VISIBLE_FIELDS)[number]]: string | number | null;
};

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function dateOrNull(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function numberOrNull(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * Deterministic outbound allowlist for action rows entering an external model.
 * New database columns are excluded unless explicitly added here after review.
 */
export function projectActionForModel(row: Record<string, unknown>): SafeActionModelProjection {
  return {
    actionId: stringOrNull(row.action_id),
    description: stringOrNull(row.action_description),
    status: stringOrNull(row.status),
    targetDate: dateOrNull(row.target_date),
    daysOverdue: numberOrNull(row.days_overdue),
    priority: stringOrNull(row.priority),
    sourceModule: stringOrNull(row.source_module),
  };
}

export function projectActionsForModel(rows: Array<Record<string, unknown>>): SafeActionModelProjection[] {
  return rows.map(projectActionForModel);
}
