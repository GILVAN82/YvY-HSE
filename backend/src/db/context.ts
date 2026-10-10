import type { Pool } from 'pg';
import { ACTION_OVERDUE_SQL } from '../domain/actions';

export type SafeDatabaseContext = {
  database: string;
  schema: string;
  userName: string;
  serverVersion: string;
  searchPath: string;
  postgresTimezone: string;
  totalActions: number;
  overdueActions: number;
};

export async function readSafeDatabaseContext(database: Pick<Pool, 'query'>): Promise<SafeDatabaseContext> {
  const result = await database.query(`
    SELECT current_database() AS database,
           current_schema() AS schema,
           current_user AS user_name,
           current_setting('server_version') AS server_version,
           current_setting('search_path') AS search_path,
           current_setting('TimeZone') AS postgres_timezone,
           (SELECT COUNT(*)::int FROM action_tracker_capa) AS total_actions,
           (SELECT COUNT(*)::int FROM action_tracker_capa WHERE ${ACTION_OVERDUE_SQL}) AS overdue_actions
  `);
  const row = result.rows[0];
  return {
    database: String(row.database), schema: String(row.schema), userName: String(row.user_name),
    serverVersion: String(row.server_version), searchPath: String(row.search_path),
    postgresTimezone: String(row.postgres_timezone), totalActions: Number(row.total_actions),
    overdueActions: Number(row.overdue_actions),
  };
}
