import { Component, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { I18nService } from '../../core/i18n.service';

type MessageStatus = 'consulting' | 'streaming' | 'done';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  status?: MessageStatus;
}

interface ModelOption {
  id: string;
  label: string;
}

interface ProviderInfo {
  id: string;
  label: string;
  available: boolean;
  models: ModelOption[];
  allowCustomModel: boolean;
}

interface AttachmentInfo {
  attachmentId: string; filename: string; kind: 'document' | 'spreadsheet' | 'image';
  mimeType: string; size: number; expiresAt: string; status: 'ready' | 'failed' | 'expired';
}

export type ProviderStatus = 'loading' | 'ready' | 'none' | 'error';

export const PROVIDER_STATUS_ERROR_MESSAGE =
  'Unable to verify the assistant configuration. Check the server connection.';

export function resolveProviderStatus(providers: ProviderInfo[], fetchFailed = false): ProviderStatus {
  if (fetchFailed) return 'error';
  return providers.some((provider) => provider.available) ? 'ready' : 'none';
}

const STORAGE_KEY = 'hse-ai-chat-provider';
export const CONVERSATION_INACTIVITY_MS = 15 * 60 * 1000;

export function hasConversationExpired(lastActivityAt: number | null, now = Date.now()): boolean {
  return lastActivityAt !== null && now - lastActivityAt >= CONVERSATION_INACTIVITY_MS;
}

export function constrainPanelDrag(
  rect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>,
  deltaX: number,
  deltaY: number,
  viewportWidth: number,
  viewportHeight: number
) {
  return {
    x: Math.max(-rect.left, Math.min(deltaX, viewportWidth - rect.right)),
    y: Math.max(-rect.top, Math.min(deltaY, viewportHeight - rect.bottom)),
  };
}

const SAFE_ERROR_MESSAGES: Record<string, string> = {
  AI_MODEL_ERROR: 'The AI service could not respond at this time.',
  AI_TOOL_FAILURE: 'I could not query the operational data right now.',
  AI_NO_DATA_FOUND: 'I could not find data matching the query.',
  AI_INVALID_REQUEST: 'I could not interpret the query parameters.',
  AI_INVALID_MODEL: 'The selected AI model is not available.',
  AI_PROVIDER_UNAVAILABLE: 'The AI service is not configured at this time.',
  AI_TIMEOUT: 'The query took longer than expected.',
  ATTACHMENT_TOO_LARGE: 'The attachment exceeds the configured file-size limit.',
  TOO_MANY_ATTACHMENTS: 'This conversation already has the maximum number of attachments.',
  UNSUPPORTED_FILE_TYPE: 'This file type is not supported.',
  CORRUPTED_FILE: 'The attachment could not be safely parsed.',
  ENCRYPTED_FILE: 'Encrypted or password-protected files are not supported.',
  ATTACHMENT_EXPIRED: 'The attachment has expired. Please attach it again.',
  ATTACHMENT_NOT_FOUND: 'The attachment was not found. Please attach it again.',
  ATTACHMENT_WRONG_THREAD: 'The attachment is not available in this conversation.',
  ATTACHMENT_PARSE_FAILED: 'The attachment could not be processed.',
};

export function safeChatErrorMessage(code?: string): string {
  return (code && SAFE_ERROR_MESSAGES[code]) || 'The query could not be completed at this time.';
}

export function buildChatPayload(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  provider: string,
  model: string,
  threadId: string | null,
  attachmentIds: string[] = [],
  locale?: string
) {
  return { message, history, provider, model, ...(threadId ? { threadId } : {}), ...(attachmentIds.length ? { attachmentIds } : {}), ...(locale ? { locale } : {}) };
}

export const SUGGESTED_PROMPTS = [
  'What is the portfolio TRIR this year?',
  'Which actions are overdue?',
  'List recent incidents',
];

@Component({
  selector: 'app-ai-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-chat-widget.component.html',
  styleUrl: './ai-chat-widget.component.scss',
})
export class AiChatWidgetComponent implements OnInit, OnDestroy {
  /** UI chrome follows the app language; free-form conversation content is not rewritten. */
  readonly i18n = inject(I18nService);
  open = signal(false);
  settingsOpen = signal(false);
  loading = signal(false);
  input = '';
  messages = signal<ChatMessage[]>([]);
  attachments = signal<AttachmentInfo[]>([]);
  uploading = signal(false);
  attachmentError = signal('');
  readonly suggestedPrompts = SUGGESTED_PROMPTS;
  panelPosition = signal({ x: 0, y: 0 });
  dragging = signal(false);

  providers = signal<ProviderInfo[]>([]);
  providerStatus = signal<ProviderStatus>('loading');
  readonly providerStatusErrorMessage = PROVIDER_STATUS_ERROR_MESSAGE;
  selectedProviderId = '';
  selectedModelId = '';
  customModel = '';
  activeThreadId: string | null = null;
  private lastActivityAt: number | null = null;
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private dragStart: { pointerX: number; pointerY: number; panelX: number; panelY: number; rect: DOMRect } | null = null;

  async ngOnInit() {
    try {
      const res = await fetch(`${environment.apiUrl}/ai/providers`);
      if (!res.ok) throw new Error('provider availability request failed');
      const list: ProviderInfo[] = await res.json();
      if (!Array.isArray(list)) throw new Error('invalid provider availability response');
      this.providers.set(list);
      this.providerStatus.set(resolveProviderStatus(list));

      const saved = this.loadSavedSelection();
      const available = list.filter((p) => p.available);
      const initial = available.find((p) => p.id === saved?.providerId) || available[0];
      if (initial) {
        this.selectedProviderId = initial.id;
        this.selectedModelId =
          saved?.providerId === initial.id && saved.modelId ? saved.modelId : initial.models[0]?.id || '';
        if (initial.allowCustomModel && saved?.providerId === initial.id) {
          this.customModel = saved.modelId || '';
        }
      }
    } catch {
      this.providers.set([]);
      this.providerStatus.set(resolveProviderStatus([], true));
    }
  }

  ngOnDestroy() {
    this.clearInactivityTimer();
  }

  get selectedProvider(): ProviderInfo | undefined {
    return this.providers().find((p) => p.id === this.selectedProviderId);
  }

  get availableProviders(): ProviderInfo[] {
    return this.providers().filter((p) => p.available);
  }

  onProviderChange() {
    const p = this.selectedProvider;
    this.selectedModelId = p?.models[0]?.id || '';
    this.customModel = '';
    this.saveSelection();
  }

  onModelChange() {
    this.saveSelection();
  }

  toggle() {
    this.open.set(!this.open());
    if (!this.open()) this.settingsOpen.set(false);
  }

  toggleSettings() {
    this.settingsOpen.set(!this.settingsOpen());
  }

  startDrag(event: PointerEvent) {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button, input, textarea, label, select, a')) return;
    const panel = (event.currentTarget as HTMLElement).closest('.panel');
    if (!panel) return;
    const position = this.panelPosition();
    this.dragStart = { pointerX: event.clientX, pointerY: event.clientY, panelX: position.x, panelY: position.y, rect: panel.getBoundingClientRect() };
    this.dragging.set(true);
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  @HostListener('document:pointermove', ['$event'])
  moveDrag(event: PointerEvent) {
    if (!this.dragStart) return;
    const constrained = constrainPanelDrag(this.dragStart.rect, event.clientX - this.dragStart.pointerX, event.clientY - this.dragStart.pointerY, window.innerWidth, window.innerHeight);
    this.panelPosition.set({ x: this.dragStart.panelX + constrained.x, y: this.dragStart.panelY + constrained.y });
  }

  @HostListener('document:pointerup')
  @HostListener('document:pointercancel')
  stopDrag() {
    this.dragStart = null;
    this.dragging.set(false);
  }

  @HostListener('window:resize')
  resetPanelPosition() {
    this.stopDrag();
    this.panelPosition.set({ x: 0, y: 0 });
  }

  useSuggestion(text: string) {
    this.input = text;
    this.send();
  }

  /** Starts a fresh logical chat without exposing persistence internals. */
  resetConversation() {
    this.clearInactivityTimer();
    this.activeThreadId = null;
    this.lastActivityAt = null;
    this.messages.set([]);
    this.attachments.set([]);
    this.attachmentError.set('');
    this.input = '';
  }

  async attachFile(event: Event) {
    const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = '';
    if (!file || this.uploading()) return;
    if (this.attachments().length >= 3) { this.attachmentError.set(this.i18n.t('This conversation already has the maximum number of attachments.')); return; }
    this.uploading.set(true); this.attachmentError.set('');
    this.activeThreadId ||= crypto.randomUUID();
    const form = new FormData(); form.append('file', file); form.append('threadId', this.activeThreadId);
    try {
      const response = await fetch(`${environment.apiUrl}/ai/attachments`, { method: 'POST', body: form });
      const body = await response.json().catch(() => null);
      if (!response.ok) { this.attachmentError.set(this.i18n.t(body?.error || 'The attachment could not be processed.')); return; }
      this.attachments.update((items) => [...items, { ...body, status: 'ready' }]);
    } catch { this.attachmentError.set(this.i18n.t('The attachment could not be processed.')); }
    finally { this.uploading.set(false); }
  }

  async removeAttachment(attachment: AttachmentInfo) {
    this.attachments.update((items) => items.filter((item) => item.attachmentId !== attachment.attachmentId));
    if (!this.activeThreadId) return;
    await fetch(`${environment.apiUrl}/ai/attachments/${attachment.attachmentId}?threadId=${encodeURIComponent(this.activeThreadId)}`, { method: 'DELETE' }).catch(() => undefined);
  }

  async send() {
    const text = this.input.trim();
    const provider = this.selectedProvider;
    const modelId = provider?.allowCustomModel ? this.customModel.trim() : this.selectedModelId;
    if (!text || this.loading() || this.uploading() || !provider || !modelId) return;
    if (hasConversationExpired(this.lastActivityAt)) this.resetConversation();
    this.markConversationActivity();
    this.input = '';

    const history = this.messages().map((m) => ({ role: m.role, content: m.content }));
    this.messages.update((m) => [...m, { role: 'user', content: text }]);
    this.messages.update((m) => [...m, { role: 'assistant', content: '', status: 'consulting' }]);
    this.loading.set(true);

    try {
      const response = await fetch(`${environment.apiUrl}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildChatPayload(text, history, provider.id, modelId, this.activeThreadId, this.attachments().filter((item) => item.status === 'ready').map((item) => item.attachmentId), this.i18n.lang())),
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        if (body?.code === 'ATTACHMENT_EXPIRED' || body?.code === 'ATTACHMENT_NOT_FOUND') {
          this.attachments.update((items) => items.map((item) => ({ ...item, status: 'expired' })));
        }
        this.appendToLast(this.i18n.t(safeChatErrorMessage(body?.code)));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          const payload = JSON.parse(line.slice(5).trim());
          if (payload.type === 'text') {
            this.setStatus('streaming');
            this.appendToLast(payload.text);
          } else if (payload.type === 'tool_use') {
            this.setStatus('consulting');
          } else if (payload.type === 'error') {
            this.appendToLast(`\n${this.i18n.t(safeChatErrorMessage(payload.code))}`);
          } else if (payload.type === 'done') {
            const returnedThreadId = payload.threadId || payload.conversationId;
            if (typeof returnedThreadId === 'string' && returnedThreadId) {
              this.activeThreadId = returnedThreadId;
            }
          }
        }
      }
      this.setStatus('done');
    } catch {
      this.appendToLast(this.i18n.t('Server connection error.'));
    } finally {
      this.loading.set(false);
    }
  }

  private appendToLast(text: string) {
    this.messages.update((msgs) => {
      const copy = [...msgs];
      const last = copy[copy.length - 1];
      copy[copy.length - 1] = { ...last, content: last.content + text };
      return copy;
    });
  }

  private setStatus(status: MessageStatus) {
    this.messages.update((msgs) => {
      const copy = [...msgs];
      const last = copy[copy.length - 1];
      copy[copy.length - 1] = { ...last, status };
      return copy;
    });
  }

  private markConversationActivity() {
    this.lastActivityAt = Date.now();
    this.clearInactivityTimer();
    this.inactivityTimer = setTimeout(() => {
      if (hasConversationExpired(this.lastActivityAt)) this.resetConversation();
    }, CONVERSATION_INACTIVITY_MS);
  }

  private clearInactivityTimer() {
    if (this.inactivityTimer !== null) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  private saveSelection() {
    const modelId = this.selectedProvider?.allowCustomModel ? this.customModel : this.selectedModelId;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ providerId: this.selectedProviderId, modelId }));
    } catch {
      // localStorage indisponível (modo privado, etc.) — apenas ignora, a preferência não persiste.
    }
  }

  private loadSavedSelection(): { providerId: string; modelId: string } | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
