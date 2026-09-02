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
