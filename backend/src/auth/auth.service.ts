import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { AuthRepository, RequestPrincipal } from './auth.types';

export const SESSION_COOKIE = 'yvy_hse_session';
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export const hashSessionToken = (token: string) => createHash('sha256').update(token).digest('hex');

export class AuthService {
  constructor(private readonly repository: AuthRepository, private readonly now = () => new Date()) {}

  async login(email: string, password: string): Promise<{ token: string; user: RequestPrincipal; expiresAt: Date } | null> {
    const user = await this.repository.findUserByEmail(email.trim().toLowerCase());
    if (!user?.active || !(await bcrypt.compare(password, user.passwordHash))) return null;
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(this.now().getTime() + SESSION_TTL_MS);
    await this.repository.createSession(user.userId, hashSessionToken(token), expiresAt);
    return { token, user: { userId: user.userId, email: user.email, displayName: user.displayName }, expiresAt };
  }

  async authenticate(token: string | undefined): Promise<RequestPrincipal | null> {
    if (!token || !/^[A-Za-z0-9_-]{40,100}$/.test(token)) return null;
    return (await this.repository.findSession(hashSessionToken(token)))?.user ?? null;
  }

  async logout(token: string | undefined): Promise<void> {
    if (token) await this.repository.deleteSession(hashSessionToken(token));
  }
}
