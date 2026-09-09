import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth.service';
import { YvyAlertService, type YvyAlert } from './yvy-alert.service';

describe('YvyAlertService', () => {
  const alert: YvyAlert = {
    id: 'alert-1', severity: 'HIGH', category: 'OVERDUE_ACTION',
    title: 'Overdue action', summary: 'Action ACT-1 is overdue.',
    sourceType: 'OPERATIONAL_DATA', sourceId: 'ACT-1',
    evidence: [{ field: 'daysOverdue', value: 5 }], ruleId: 'OVERDUE_HIGH_PRIORITY_ACTION',
    status: 'ALERTED', createdAt: '2026-09-02T00:00:00.000Z', notificationCount: 0,
  };

  afterEach(() => {
    localStorage.removeItem('yvy-alert-preferences');
  });

  it('loads evidence-backed alerts and calculates active severity counts', async () => {
    spyOn(window, 'fetch').and.resolveTo(new Response(JSON.stringify({ alerts: [alert] }), { status: 200 }));
    const service = new YvyAlertService();

    await service.refresh();

    expect(service.alerts()).toEqual([alert]);
    expect(service.active().length).toBe(1);
    expect(service.high()).toBe(1);
    expect(service.critical()).toBe(0);
  });

  it('keeps acknowledged alerts in history but removes them from active counts', async () => {
    const acknowledged = { ...alert, status: 'ACKNOWLEDGED' as const, acknowledgedAt: '2026-09-02T01:00:00.000Z' };
    spyOn(window, 'fetch').and.resolveTo(new Response(JSON.stringify({ alert: acknowledged }), { status: 200 }));
    const service = new YvyAlertService();
    service.alerts.set([alert]);

    expect(await service.acknowledge(alert.id)).toBeTrue();

    expect(service.alerts()[0].status).toBe('ACKNOWLEDGED');
    expect(service.active().length).toBe(0);
  });

  it('stores voice preferences locally with conservative defaults', () => {
    const service = new YvyAlertService();
    expect(service.preferences()).toEqual({ criticalVoice: true, highVoice: false, routineReminders: false, desktopNotifications: false });

    service.setPreferences({ criticalVoice: false, highVoice: true, routineReminders: false, desktopNotifications: false });

    expect(JSON.parse(localStorage.getItem('yvy-alert-preferences')!)).toEqual(service.preferences());
  });

  it('keeps snooze distinct from acknowledgement and resolution', async () => {
    const snoozed = { ...alert, snoozedUntil: '2099-09-02T01:00:00.000Z' };
    spyOn(window, 'fetch').and.resolveTo(new Response(JSON.stringify({ alert: snoozed }), { status: 200 }));
    const service = new YvyAlertService(); service.alerts.set([alert]);
    expect(await service.snooze(alert.id, 30)).toBeTrue();
    expect(service.alerts()[0].status).toBe('ALERTED');
    expect(service.alerts()[0].resolvedAt).toBeUndefined();
    expect(service.active().length).toBe(0);
  });

  it('reevaluates during an active session without page reload', async () => {
    jasmine.clock().install();
    const service = new YvyAlertService(); spyOn(service, 'refresh').and.resolveTo(true); const refreshed=jasmine.createSpy('refreshed');
    const stop=service.startContinuousAttention(refreshed, 1_000);jasmine.clock().tick(1_001);await Promise.resolve();
    expect(service.refresh).toHaveBeenCalled();stop();jasmine.clock().uninstall();
  });
});

describe('attention identity isolation without a Command Center',()=>{
  const user=(id:string)=>({userId:id,email:id+'@example.invalid',displayName:id,role:'HSE_USER' as const,permissions:['AI_USE'],allowedProjectIds:['PRJ-A']});
  afterEach(()=>TestBed.resetTestingModule());
  it('clears all user A state when A logs out and B logs in',()=>{
    TestBed.configureTestingModule({providers:[AuthService,YvyAlertService]});
    const auth=TestBed.inject(AuthService);auth.user.set(user('A'));
    const service=TestBed.inject(YvyAlertService);TestBed.flushEffects();
    service.alerts.set([{id:'A-private'} as any]);service.events.set([{id:'A-event'} as any]);service.voiceCandidates.set([{id:'A-claim'} as any]);service.error.set('A-error');service.evaluatedAt.set('A-time');service.returnSummary.set({INFO:0,ATTENTION:0,HIGH:1,CRITICAL:0,total:1});
    auth.user.set(null);TestBed.flushEffects();auth.user.set(user('B'));TestBed.flushEffects();
    expect(service.alerts()).toEqual([]);expect(service.events()).toEqual([]);expect(service.voiceCandidates()).toEqual([]);expect(service.returnSummary().total).toBe(0);expect(service.error()).toBe('');expect(service.evaluatedAt()).toBe('');
  });
  it('discards a late A response before effects have flushed for B',async()=>{
    TestBed.configureTestingModule({providers:[AuthService,YvyAlertService]});
    const auth=TestBed.inject(AuthService);auth.user.set(user('A'));
    const service=TestBed.inject(YvyAlertService);TestBed.flushEffects();
    let finish!:(r:Response)=>void;
    spyOn(window,'fetch').and.callFake(()=>new Promise<Response>(resolve=>finish=resolve));
    const pending=service.refresh();auth.user.set(user('B'));
    finish(new Response(JSON.stringify({alerts:[{id:'A-private'}],events:[{id:'A-event'}]})));
    expect(await pending).toBeFalse();expect(service.alerts()).toEqual([]);expect(service.events()).toEqual([]);expect(service.error()).toBe('');
  });
  it('does not let a late A mutation replace B state',async()=>{
    TestBed.configureTestingModule({providers:[AuthService,YvyAlertService]});
    const auth=TestBed.inject(AuthService);auth.user.set(user('A'));const service=TestBed.inject(YvyAlertService);TestBed.flushEffects();
    let finish!:(r:Response)=>void;spyOn(window,'fetch').and.callFake(()=>new Promise<Response>(resolve=>finish=resolve));
    const pending=service.acknowledge('A-private');auth.user.set(user('B'));TestBed.flushEffects();service.alerts.set([{id:'B-private'} as any]);
    finish(new Response(JSON.stringify({alert:{id:'A-private',summary:'private'}})));
    expect(await pending).toBeFalse();expect(service.alerts().map(a=>a.id)).toEqual(['B-private']);
  });
});
