'use strict';

const net = require('node:net');
const { execFileSync } = require('node:child_process');
const { DEMO_DATABASE_NAME } = require('./config');
const { connect, readSummary } = require('./demo-lib');

const DEMO_BACKEND_PORT = 3000;

function findListeningPid(port, platform = process.platform) {
  try {
    if (platform === 'win32') {
      const output = execFileSync(
        'powershell.exe',
        ['-NoProfile', '-Command', `(Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess)`],
        { encoding: 'utf8', windowsHide: true, timeout: 5000 }
      ).trim();
      return /^\d+$/.test(output) ? Number(output) : null;
    }
    const output = execFileSync('lsof', ['-t', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8', timeout: 5000 }).trim().split(/\s+/)[0];
    return /^\d+$/.test(output) ? Number(output) : null;
  } catch {
    return null;
  }
}

function checkPortAvailable(port = DEMO_BACKEND_PORT, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', (error) => {
      if (error && error.code === 'EADDRINUSE') {
        resolve({ available: false, pid: findListeningPid(port) });
        return;
      }
      reject(error);
    });
    server.listen({ port, host, exclusive: true }, () => {
      server.close((error) => error ? reject(error) : resolve({ available: true, pid: null }));
    });
  });
}

function refusalMessage(pid) {
  return [
    'DEMO START REFUSED',
    `Port ${DEMO_BACKEND_PORT} is already in use.`,
    ...(Number.isInteger(pid) ? [`Listening process PID: ${pid}`] : []),
    'Stop the existing backend before starting Demo Mode.',
  ].join('\n');
}

function startupBanner(summary) {
  return [
    'YVY HSE DEMO MODE',
    `Database: ${summary.database}`,
    `Backend: http://localhost:${DEMO_BACKEND_PORT}`,
    'Demo database verified: YES',
    `Projects: ${summary.projects}`,
    `Active Data Center Projects: ${summary.activeDataCenterProjects}`,
    `Actions: ${summary.actions}`,
    `Overdue Actions: ${summary.overdueActions}`,
  ].join('\n');
}

async function runDemoStartPreflight({ targetUrl, checkPort = checkPortAvailable, connectDatabase = connect } = {}) {
  const port = await checkPort(DEMO_BACKEND_PORT);
  if (!port.available) return { ok: false, reason: 'PORT_OCCUPIED', message: refusalMessage(port.pid), pid: port.pid };

  const client = await connectDatabase(targetUrl);
  try {
    const database = (await client.query('SELECT current_database() AS name')).rows[0]?.name;
    if (database !== DEMO_DATABASE_NAME) {
      throw new Error(`DEMO START REFUSED: connected database is ${database || 'unknown'}, expected ${DEMO_DATABASE_NAME}`);
    }
    const summary = await readSummary(client);
    return { ok: true, reason: null, summary, message: startupBanner(summary) };
  } finally {
    await client.end();
  }
}

module.exports = {
  DEMO_BACKEND_PORT,
  checkPortAvailable,
  findListeningPid,
  refusalMessage,
  runDemoStartPreflight,
  startupBanner,
};
