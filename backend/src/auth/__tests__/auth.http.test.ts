import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import bcrypt from 'bcryptjs';
import type { AuthRepository, AuthUser, SessionRecord } from '../auth.types';
import { AuthService, hashSessionToken } from '../auth.service';
import { createAuthRouter } from '../../routes/auth';
import { requireAuthentication } from '../auth.middleware';

class FakeAuthRepository implements AuthRepository {
  sessions = new Map<string, SessionRecord>();
  user: AuthUser | null = null;
  async findUserByEmail(email: string) { return this.user?.email === email ? this.user : null; }
  async createSession(_userId: string, hash: string, expiresAt: Date) { if (this.user) this.sessions.set(hash, { user: this.user, expiresAt }); }
  async findSession(hash: string) { const item=this.sessions.get(hash); return item && item.expiresAt > new Date() && item.user.active !== false ? item : null; }
  async deleteSession(hash: string) { this.sessions.delete(hash); }
}

const servers: http.Server[] = [];
afterEach(async () => Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve())))));

async function start(repository: FakeAuthRepository) {
  const service = new AuthService(repository);
  const app = express(); app.use(express.json()); app.use('/api', createAuthRouter(service));
  app.get('/api/protected', requireAuthentication(service), (req: any, res) => res.json({ userId: req.principal.userId }));
  const server=app.listen(0,'127.0.0.1'); servers.push(server); await new Promise<void>((resolve)=>server.once('listening',resolve));
  return (server.address() as any).port as number;
}

async function request(port:number, method:string, path:string, body?:unknown, cookie?:string) {
  const data=body===undefined?'':JSON.stringify(body);
  return new Promise<{status:number;body:any;cookie?:string}>((resolve,reject)=>{ const req=http.request({hostname:'127.0.0.1',port,path,method,headers:{...(data?{'content-type':'application/json','content-length':Buffer.byteLength(data)}:{}),...(cookie?{cookie}:{})}},res=>{let raw='';res.on('data',c=>raw+=c);res.on('end',()=>resolve({status:res.statusCode??0,body:raw?JSON.parse(raw):null,cookie:res.headers['set-cookie']?.[0].split(';')[0]}));});req.on('error',reject);req.end(data); });
}

describe('authentication HTTP foundation',()=>{
  test('login, me, protected route and logout use an opaque HttpOnly session',async()=>{
    const repo=new FakeAuthRepository(); repo.user={userId:'11111111-1111-4111-8111-111111111111',email:'demo@example.invalid',displayName:'Demo User',passwordHash:await bcrypt.hash('correct-password',4),active:true};
    const port=await start(repo); const login=await request(port,'POST','/api/auth/login',{email:repo.user.email,password:'correct-password',userId:'spoofed'});
    assert.equal(login.status,200); assert.ok(login.cookie?.startsWith('yvy_hse_session=')); assert.equal(login.body.user.userId,repo.user.userId);
    const me=await request(port,'GET','/api/auth/me',undefined,login.cookie); assert.equal(me.status,200); assert.equal(me.body.user.displayName,'Demo User');
    assert.equal((await request(port,'GET','/api/protected',undefined,login.cookie)).status,200);
    assert.equal((await request(port,'POST','/api/auth/logout',{},login.cookie)).status,204);
    assert.equal((await request(port,'GET','/api/auth/me',undefined,login.cookie)).status,401);
  });
  test('invalid credentials, missing, malformed, expired and disabled sessions fail closed',async()=>{
    const repo=new FakeAuthRepository(); repo.user={userId:'11111111-1111-4111-8111-111111111111',email:'demo@example.invalid',displayName:'Demo User',passwordHash:await bcrypt.hash('correct-password',4),active:true};
    const port=await start(repo); assert.equal((await request(port,'POST','/api/auth/login',{email:repo.user.email,password:'wrong-password'})).status,401);
    assert.equal((await request(port,'GET','/api/protected')).status,401); assert.equal((await request(port,'GET','/api/protected',undefined,'yvy_hse_session=bad')).status,401);
    const expired='a'.repeat(43); repo.sessions.set(hashSessionToken(expired),{user:repo.user,expiresAt:new Date(0)}); assert.equal((await request(port,'GET','/api/protected',undefined,`yvy_hse_session=${expired}`)).status,401);
    repo.user.active=false; assert.equal((await request(port,'POST','/api/auth/login',{email:repo.user.email,password:'correct-password'})).status,401);
  });
});
