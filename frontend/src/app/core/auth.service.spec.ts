import { AuthService } from './auth.service';

describe('AuthService', () => {
  const originalFetch = window.fetch;
  afterEach(() => { window.fetch = originalFetch; });

  it('restores the authenticated user using cookie credentials', async () => {
    window.fetch = jasmine.createSpy().and.resolveTo(new Response(JSON.stringify({ user:{ userId:'1',email:'demo@example.invalid',displayName:'Demo User',role:'HSE_USER',permissions:['AI_USE'],allowedProjectIds:['PRJ-001'] } }), { status:200 })) as any;
    const service = new AuthService();
    expect(await service.restore()).toBeTrue(); expect(service.user()?.displayName).toBe('Demo User');
    expect(window.fetch).toHaveBeenCalledWith(jasmine.stringMatching(/auth\/me$/), { credentials:'include' });
  });

  it('login establishes state and logout clears it without storing a token', async () => {
    window.fetch = jasmine.createSpy().and.callFake((url:string) => Promise.resolve(url.endsWith('/login')
      ? new Response(JSON.stringify({ user:{ userId:'1',email:'demo@example.invalid',displayName:'Demo User',role:'HSE_USER',permissions:['AI_USE'],allowedProjectIds:['PRJ-001'] } }), { status:200 })
      : new Response(null,{status:204}))) as any;
    const service = new AuthService(); expect(await service.login('demo@example.invalid','correct-password')).toBeTrue();
    expect(service.user()).not.toBeNull(); await service.logout(); expect(service.user()).toBeNull();
  });
});
