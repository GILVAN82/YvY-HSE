'use strict';

const path = require('node:path');

const DEMO_DATABASE_NAME = 'hse_app_demo';
const BACKEND_DIR = path.resolve(__dirname, '../../backend');

// Reuse the repository's established dotenv dependency. This reads configuration
// without changing backend/.env and never prints connection strings or secrets.
require(path.join(BACKEND_DIR, 'node_modules/dotenv')).config({
  path: path.join(BACKEND_DIR, '.env'),
  override: false,
});

function demoDatabaseUrl(environment = process.env) {
  const explicit = environment.DEMO_DATABASE_URL?.trim();
  const base = explicit || environment.DATABASE_URL?.trim();
  if (!base) throw new Error('DEMO_DATABASE_URL or DATABASE_URL is required');
  const url = new URL(base);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('PostgreSQL is required');
  if (!explicit) url.pathname = `/${DEMO_DATABASE_NAME}`;
  if (url.pathname.replace(/^\//, '') !== DEMO_DATABASE_NAME) {
    throw new Error(`DEMO RESET REFUSED: target database must be exactly ${DEMO_DATABASE_NAME}`);
  }
  return url.toString();
}

function adminDatabaseUrl(targetUrl) {
  const url = new URL(targetUrl);
  url.pathname = '/postgres';
  return url.toString();
}

module.exports = { BACKEND_DIR, DEMO_DATABASE_NAME, adminDatabaseUrl, demoDatabaseUrl };
