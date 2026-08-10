import { Pool } from 'pg';
import { requireDatabaseUrl } from './config';

export const pool = new Pool({
  connectionString: requireDatabaseUrl(),
});
