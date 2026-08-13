import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

export interface AuthenticatedUser { userId: string; email: string; displayName: string }

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<AuthenticatedUser | null>(null);
  private restored = false;

  async restore(): Promise<boolean> {
    if (this.restored) return this.user() !== null;
    this.restored = true;
    try {
      const response = await fetch(`${environment.apiUrl}/auth/me`, { credentials: 'include' });
      if (!response.ok) return false;
      this.user.set((await response.json()).user);
      return true;
    } catch { return false; }
  }

  async login(email: string, password: string): Promise<boolean> {
    const response = await fetch(`${environment.apiUrl}/auth/login`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
    });
    if (!response.ok) return false;
    this.user.set((await response.json()).user);
    this.restored = true;
    return true;
  }

  async logout(): Promise<void> {
    try { await fetch(`${environment.apiUrl}/auth/logout`, { method: 'POST', credentials: 'include' }); } finally {
      this.user.set(null); this.restored = true;
    }
  }
}
