import '../config/env.bootstrap';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool';

async function main() {
  const email = process.env.DEMO_USER_EMAIL?.trim().toLowerCase();
  const password = process.env.DEMO_USER_PASSWORD;
  const displayName = process.env.DEMO_USER_DISPLAY_NAME?.trim() || 'YvY HSE Demo User';
  if (!email || !password || password.length < 12) throw new Error('Set DEMO_USER_EMAIL and a DEMO_USER_PASSWORD of at least 12 characters.');
  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO app_user(id,email,display_name,password_hash,active) VALUES($1,$2,$3,$4,true)
     ON CONFLICT(email) DO UPDATE SET display_name=EXCLUDED.display_name,password_hash=EXCLUDED.password_hash,active=true,updated_at=now()`,
    [randomUUID(), email, displayName, hash]
  );
  console.log(`Provisioned synthetic demo user: ${email}`);
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : 'Provisioning failed'); process.exitCode=1; }).finally(() => pool.end());
