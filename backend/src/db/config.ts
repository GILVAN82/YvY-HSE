import '../config/env.bootstrap';

export type SafeDatabaseConfig = {
  host: string;
  port: number;
  database: string;
  sslRequested: boolean;
};

export function requireDatabaseUrl(environment: NodeJS.ProcessEnv = process.env): string {
  const value = environment.DATABASE_URL?.trim();
  if (!value) throw new Error('Database configuration is required');
  return value;
}

export function readSafeDatabaseConfig(environment: NodeJS.ProcessEnv = process.env): SafeDatabaseConfig {
  const parsed = new URL(requireDatabaseUrl(environment));
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('Database configuration must use PostgreSQL');
  }
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    database: parsed.pathname.replace(/^\//, ''),
    sslRequested: parsed.searchParams.has('sslmode') && parsed.searchParams.get('sslmode') !== 'disable',
  };
}
