import type { Pool } from 'pg';
import type { AuthRepository, AuthUser, SessionRecord } from './auth.types';
import { permissionsForRole, type AppRole } from './authorization';

export class PostgresAuthRepository implements AuthRepository {
  constructor(private readonly db: Pick<Pool, 'query'>) {}

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    const result = await this.db.query(
      `SELECT u.id::text, u.email, u.display_name, u.password_hash, u.active, u.role,
              COALESCE(array_agg(up.project_code) FILTER (WHERE up.project_code IS NOT NULL),'{}') AS allowed_projects
       FROM app_user u LEFT JOIN app_user_project up ON up.user_id=u.id
       WHERE lower(u.email)=lower($1) GROUP BY u.id`, [email]
    );
    if (!result.rowCount) return null;
    const row = result.rows[0];
    const role=row.role as AppRole; return { userId:row.id,email:row.email,displayName:row.display_name,passwordHash:row.password_hash,active:row.active===true,role,permissions:permissionsForRole(role),allowedProjectIds:row.allowed_projects??[] };
  }

  async createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.db.query('INSERT INTO app_session(token_hash,user_id,expires_at) VALUES($1,$2,$3)', [tokenHash, userId, expiresAt]);
  }

  async findSession(tokenHash: string): Promise<SessionRecord | null> {
    const result = await this.db.query(
      `SELECT u.id::text, u.email, u.display_name, u.role, s.expires_at,
              COALESCE(array_agg(up.project_code) FILTER (WHERE up.project_code IS NOT NULL),'{}') AS allowed_projects
       FROM app_session s JOIN app_user u ON u.id=s.user_id LEFT JOIN app_user_project up ON up.user_id=u.id
       WHERE s.token_hash=$1 AND s.expires_at > now() AND u.active=true GROUP BY u.id,s.expires_at`, [tokenHash]
    );
    if (!result.rowCount) return null;
    const row = result.rows[0];
    const role=row.role as AppRole; return { user:{userId:row.id,email:row.email,displayName:row.display_name,role,permissions:permissionsForRole(role),allowedProjectIds:row.allowed_projects??[]},expiresAt:row.expires_at };
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.db.query('DELETE FROM app_session WHERE token_hash=$1', [tokenHash]);
  }
}
