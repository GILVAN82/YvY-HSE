import { YvyAlertService, type YvyAlert } from './yvy-alert.service';

describe('YvyAlertService', () => {
  const alert: YvyAlert = {
    id: 'alert-1', severity: 'HIGH', category: 'OVERDUE_ACTION',
    title: 'Overdue action', summary: 'Action ACT-1 is overdue.',
    sourceType: 'OPERATIONAL_DATA', sourceId: 'ACT-1',
    evidence: [{ field: 'daysOverdue', value: 5 }], ruleId: 'OVERDUE_HIGH_PRIORITY_ACTION',
    status: 'ALERTED', createdAt: '2026-09-02T00:00:00.000Z',
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
    expect(service.preferences()).toEqual({ criticalVoice: true, highVoice: false, desktopNotifications: false });

    service.setPreferences({ criticalVoice: false, highVoice: true, desktopNotifications: false });

    expect(JSON.parse(localStorage.getItem('yvy-alert-preferences')!)).toEqual(service.preferences());
  });
});
