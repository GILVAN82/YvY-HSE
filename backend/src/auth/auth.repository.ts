import type { Pool } from 'pg';
import type { AuthRepository, AuthUser, SessionRecord } from './auth.types';

export class PostgresAuthRepository implements AuthRepository {
  constructor(private readonly db: Pick<Pool, 'query'>) {}

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    const result = await this.db.query(
      `SELECT id::text, email, display_name, password_hash, active
       FROM app_user WHERE lower(email)=lower($1)`, [email]
    );
    if (!result.rowCount) return null;
    const row = result.rows[0];
    return { userId: row.id, email: row.email, displayName: row.display_name, passwordHash: row.password_hash, active: row.active === true };
  }

  async createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.db.query('INSERT INTO app_session(token_hash,user_id,expires_at) VALUES($1,$2,$3)', [tokenHash, userId, expiresAt]);
  }

  async findSession(tokenHash: string): Promise<SessionRecord | null> {
    const result = await this.db.query(
      `SELECT u.id::text, u.email, u.display_name, s.expires_at
       FROM app_session s JOIN app_user u ON u.id=s.user_id
       WHERE s.token_hash=$1 AND s.expires_at > now() AND u.active=true`, [tokenHash]
    );
    if (!result.rowCount) return null;
    const row = result.rows[0];
    return { user: { userId: row.id, email: row.email, displayName: row.display_name }, expiresAt: row.expires_at };
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.db.query('DELETE FROM app_session WHERE token_hash=$1', [tokenHash]);
  }
}
