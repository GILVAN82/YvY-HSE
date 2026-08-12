import {
  AiChatWidgetComponent,
  buildChatPayload,
  CONVERSATION_INACTIVITY_MS,
  constrainPanelDrag,
  hasConversationExpired,
  PROVIDER_STATUS_ERROR_MESSAGE,
  resolveProviderStatus,
  safeChatErrorMessage,
} from './ai-chat-widget.component';
import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../core/i18n.service';

describe('AI chat widget contract', () => {
  it('keeps a dragged chatbot panel inside the visible viewport', () => {
    const rect = { left: 100, right: 540, top: 80, bottom: 680 } as DOMRect;
    expect(constrainPanelDrag(rect, -500, 900, 1200, 800)).toEqual({ x: -100, y: 120 });
    expect(constrainPanelDrag(rect, 50, -20, 1200, 800)).toEqual({ x: 50, y: -20 });
  });
  it('expires a conversation after 15 minutes of inactivity', () => {
    const startedAt = 1_000;
    expect(hasConversationExpired(startedAt, startedAt + CONVERSATION_INACTIVITY_MS - 1)).toBeFalse();
    expect(hasConversationExpired(startedAt, startedAt + CONVERSATION_INACTIVITY_MS)).toBeTrue();
    expect(hasConversationExpired(null, startedAt + CONVERSATION_INACTIVITY_MS)).toBeFalse();
  });

  it('omits a thread identifier for the first turn', () => {
    expect(buildChatPayload('Olá', [], 'openai', 'gpt-5.5', null)).toEqual({
      message: 'Olá', history: [], provider: 'openai', model: 'gpt-5.5',
    });
  });

  it('sends the returned thread identifier on subsequent turns', () => {
    const threadId = '11111111-2222-4333-8444-555555555555';
    expect(buildChatPayload('E depois?', [], 'openai', 'gpt-5.5', threadId).threadId).toBe(threadId);
  });

  it('adds temporary attachment identifiers without changing legacy payloads', () => {
    expect(buildChatPayload('Review this HSE file', [], 'openai', 'gpt-5.4-mini', '11111111-2222-4333-8444-555555555555', ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']).attachmentIds)
      .toEqual(['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']);
    expect(buildChatPayload('LOTO?', [], 'openai', 'gpt-5.4-mini', null)).not.toEqual(jasmine.objectContaining({ attachmentIds: jasmine.anything() }));
  });

  it('adds the selected UI language as an optional backwards-compatible locale', () => {
    expect(buildChatPayload('?', [], 'openai', 'gpt-5.4-mini', null, [], 'es').locale).toBe('es');
    expect(buildChatPayload('?', [], 'openai', 'gpt-5.4-mini', null)).not.toEqual(jasmine.objectContaining({ locale: jasmine.anything() }));
  });

  it('maps controlled backend errors without exposing raw details', () => {
    expect(safeChatErrorMessage('AI_MODEL_ERROR')).toContain('AI service');
    expect(safeChatErrorMessage('AI_TOOL_FAILURE')).toContain('operational data');
    expect(safeChatErrorMessage('AI_NO_DATA_FOUND')).toContain('find data');
    expect(safeChatErrorMessage('AI_INVALID_REQUEST')).toContain('parameters');
    expect(safeChatErrorMessage('AI_TIMEOUT')).toContain('longer');
    expect(safeChatErrorMessage('unknown: SQL SELECT secret')).toBe(
      'The query could not be completed at this time.'
    );
  });

  it('shows the assistant when at least one provider is available', () => {
    expect(resolveProviderStatus([{ id: 'openai', label: 'OpenAI', available: true, models: [], allowCustomModel: false }])).toBe('ready');
  });

  it('reserves the not-configured state for a successful empty availability result', () => {
    expect(resolveProviderStatus([])).toBe('none');
  });

  it('does not claim that the provider is unconfigured when the fetch fails', () => {
    expect(resolveProviderStatus([], true)).toBe('error');
    expect(PROVIDER_STATUS_ERROR_MESSAGE).toContain('server connection');
    expect(PROVIDER_STATUS_ERROR_MESSAGE).not.toContain('not configured');
  });
});

describe('AI chat widget conversation controls', () => {
  function createComponent() {
    TestBed.configureTestingModule({
      imports: [AiChatWidgetComponent],
      providers: [{ provide: I18nService, useValue: { t: (value: string) => value, lang: () => 'en' } }],
    });
    return TestBed.createComponent(AiChatWidgetComponent);
  }

  afterEach(() => TestBed.resetTestingModule());

  it('close preserves messages and the active thread identifier', () => {
    const fixture = createComponent(); const component = fixture.componentInstance;
    component.open.set(true);
    component.messages.set([{ role: 'user', content: 'LOTO question' }]);
    component.activeThreadId = '11111111-2222-4333-8444-555555555555';
    component.toggle();
    component.toggle();
    expect(component.messages().map((message) => message.content)).toEqual(['LOTO question']);
    expect(component.activeThreadId).toBe('11111111-2222-4333-8444-555555555555');
  });

  it('new conversation clears only transient conversation state', () => {
    const fixture = createComponent(); const component = fixture.componentInstance;
    const fetchSpy = spyOn(globalThis, 'fetch');
    component.messages.set([{ role: 'assistant', content: 'PostgreSQL' }]);
    component.attachments.set([{ attachmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', filename: 'procedure.pdf', kind: 'document', mimeType: 'application/pdf', size: 10, expiresAt: 'x', status: 'ready' }]);
    component.activeThreadId = '11111111-2222-4333-8444-555555555555';
    component.input = 'pending text';
    component.selectedProviderId = 'openai'; component.selectedModelId = 'gpt-5.4-mini';
    component.resetConversation();
    expect(component.messages()).toEqual([]);
    expect(component.attachments()).toEqual([]);
    expect(component.activeThreadId).toBeNull();
    expect(component.input).toBe('');
    expect(component.selectedProviderId).toBe('openai');
    expect(component.selectedModelId).toBe('gpt-5.4-mini');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('renders an explicit accessible new conversation control', () => {
    const fixture = createComponent(); const component = fixture.componentInstance;
    component.open.set(true); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[aria-label="New conversation"]')).not.toBeNull();
  });

  it('does not expose provider or model configuration inside the chatbot', () => {
    const fixture = createComponent(); const component = fixture.componentInstance;
    component.open.set(true);
    component.providers.set([{ id: 'openai', label: 'OpenAI (GPT)', available: true, models: [{ id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini' }], allowCustomModel: false }]);
    component.providerStatus.set('ready'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[title="Assistant settings"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.settingsdrawer')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Response model');
    expect(fixture.nativeElement.textContent).not.toContain('GPT-5.4 Mini');
  });

  it('renders the paperclip picker with supported formats and compact chips', () => {
    const fixture = createComponent(); const component = fixture.componentInstance;
    component.open.set(true); component.providerStatus.set('ready');
    component.attachments.set([{ attachmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', filename: 'procedure.pdf', kind: 'document', mimeType: 'application/pdf', size: 10, expiresAt: 'x', status: 'ready' }]);
    fixture.detectChanges();
    const picker = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    expect(picker.accept).toContain('.pdf'); expect(picker.accept).toContain('.xlsx'); expect(picker.accept).toContain('.webp');
    expect(fixture.nativeElement.querySelector('.attachment-chip').textContent).toContain('procedure.pdf');
    expect(fixture.nativeElement.textContent).not.toContain('C:\\');
  });

  it('renders assistant Markdown while keeping user-authored content plain', () => {
    const fixture = createComponent(); const component = fixture.componentInstance;
    component.open.set(true); component.providerStatus.set('ready');
    component.messages.set([
      { role: 'assistant', content: '**Risk Level:** High\n\n1. Isolate\n2. Verify' },
      { role: 'user', content: '**keep this plain** <img src=x onerror=alert(1)>' },
    ]);
    fixture.detectChanges();
    const messages = fixture.nativeElement.querySelectorAll('.msg');
    expect(messages[0].querySelector('strong')?.textContent).toContain('Risk Level');
    expect(messages[0].querySelectorAll('ol li').length).toBe(2);
    expect(messages[0].textContent).not.toContain('**');
    expect(messages[1].querySelector('strong')).toBeNull();
    expect(messages[1].querySelector('img')).toBeNull();
    expect(messages[1].textContent).toContain('**keep this plain**');
  });

  it('renders Approve and Reject only for a real pending approval', () => {
    const fixture = createComponent(); const component = fixture.componentInstance;
    component.open.set(true); component.providerStatus.set('ready');
    component.approval.set({ approvalId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', threadId: '11111111-2222-4333-8444-555555555555', actionType: 'LOTO_SAFETY_EXECUTION', riskLevel: 'CRITICAL', status: 'PENDING' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.approval-panel').textContent).toContain('Human Approval Required');
    expect(fixture.nativeElement.querySelector('button.approve')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('button.reject')).not.toBeNull();
  });

  it('updates to APPROVED from the backend response and removes decision buttons', async () => {
    const fixture = createComponent(); const component = fixture.componentInstance;
    const pending = { approvalId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', threadId: '11111111-2222-4333-8444-555555555555', actionType: 'LOTO_SAFETY_EXECUTION', riskLevel: 'CRITICAL', status: 'PENDING' as const };
    component.open.set(true); component.providerStatus.set('ready'); component.approval.set(pending);
    const approved = { ...pending, status: 'APPROVED' as const, resolvedAt: '2026-08-12T12:00:00.000Z' };
    spyOn(globalThis, 'fetch').and.resolveTo(new Response(JSON.stringify({ approval: approved, text: 'Human approval recorded. Field verification remains required.' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    await component.resolveApproval('approve'); fixture.detectChanges();
    expect(component.approval()?.status).toBe('APPROVED');
    expect(fixture.nativeElement.querySelector('button.approve')).toBeNull();
    expect(fixture.nativeElement.querySelector('button.reject')).toBeNull();
    expect(component.messages().at(-1)?.content).toContain('Field verification');
  });

  it('updates to REJECTED from the backend response and removes decision buttons', async () => {
    const fixture = createComponent(); const component = fixture.componentInstance;
    const pending = { approvalId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', threadId: '22222222-2222-4222-8222-222222222222', actionType: 'LOTO_SAFETY_EXECUTION', riskLevel: 'CRITICAL', status: 'PENDING' as const };
    component.open.set(true); component.providerStatus.set('ready'); component.approval.set(pending);
    const rejected = { ...pending, status: 'REJECTED' as const, resolvedAt: '2026-08-12T12:00:00.000Z' };
    spyOn(globalThis, 'fetch').and.resolveTo(new Response(JSON.stringify({ approval: rejected, text: 'The critical LOTO action remains blocked.' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    await component.resolveApproval('reject'); fixture.detectChanges();
    expect(component.approval()?.status).toBe('REJECTED');
    expect(fixture.nativeElement.querySelector('.approval-panel').textContent).toContain('REJECTED');
    expect(fixture.nativeElement.querySelector('.approval-actions')).toBeNull();
  });

  it('the next message omits the old thread and accepts a different backend thread', async () => {
    const oldThreadId = '11111111-2222-4333-8444-555555555555';
    const newThreadId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const fixture = createComponent(); const component = fixture.componentInstance;
    component.providers.set([{ id: 'openai', label: 'OpenAI', available: true, models: [{ id: 'gpt-5.4-mini', label: 'GPT' }], allowCustomModel: false }]);
    component.selectedProviderId = 'openai'; component.selectedModelId = 'gpt-5.4-mini';
    component.activeThreadId = oldThreadId;
    component.resetConversation();
    const responseBody = `data: ${JSON.stringify({ type: 'text', text: 'New thread.' })}\n\ndata: ${JSON.stringify({ type: 'done', threadId: newThreadId })}\n\n`;
    const fetchSpy = spyOn(globalThis, 'fetch').and.resolveTo(new Response(responseBody, { status: 200 }));
    component.input = 'Which database?';
    await component.send();
    const request = fetchSpy.calls.mostRecent().args[1] as RequestInit;
    expect(JSON.parse(request.body as string).threadId).toBeUndefined();
    expect(component.activeThreadId).not.toBe(oldThreadId);
    expect(component.activeThreadId).toBe(newThreadId);
  });
});
