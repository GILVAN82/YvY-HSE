import '../config/env.bootstrap';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool';
import { ROLES,type AppRole } from './authorization';

async function main() {
  const email = process.env.DEMO_USER_EMAIL?.trim().toLowerCase();
  const password = process.env.DEMO_USER_PASSWORD;
  const displayName = process.env.DEMO_USER_DISPLAY_NAME?.trim() || 'YvY HSE Demo User';
  const role=(process.env.DEMO_USER_ROLE?.trim()||'HSE_USER') as AppRole;
  const projects=(process.env.DEMO_USER_PROJECTS||'').split(',').map(v=>v.trim()).filter(Boolean);
  if (!email || !password || password.length < 12) throw new Error('Set DEMO_USER_EMAIL and a DEMO_USER_PASSWORD of at least 12 characters.');
  if(!ROLES.includes(role))throw new Error('DEMO_USER_ROLE must be ADMIN, HSE_MANAGER, HSE_USER or APPROVER.');
  if(role!=='ADMIN'&&!projects.length)throw new Error('Non-admin users require DEMO_USER_PROJECTS.');
  const hash = await bcrypt.hash(password, 12);
  const client=await pool.connect(); try{await client.query('BEGIN');
    const result=await client.query(`INSERT INTO app_user(id,email,display_name,password_hash,active,role) VALUES($1,$2,$3,$4,true,$5)
      ON CONFLICT(email) DO UPDATE SET display_name=EXCLUDED.display_name,password_hash=EXCLUDED.password_hash,active=true,role=EXCLUDED.role,updated_at=now() RETURNING id`,[randomUUID(),email,displayName,hash,role]);
    const userId=result.rows[0].id; await client.query('DELETE FROM app_user_project WHERE user_id=$1',[userId]);
    for(const code of projects)await client.query('INSERT INTO app_user_project(user_id,project_code) VALUES($1,$2)',[userId,code]);
    await client.query('COMMIT'); console.log(`Provisioned synthetic demo user: ${email} (${role}, ${role==='ADMIN'?'all projects':projects.length+' scoped projects'})`);
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : 'Provisioning failed'); process.exitCode=1; }).finally(() => pool.end());
