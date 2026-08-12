import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgentInspectorService } from '../../core/agent-inspector.service';

@Component({
  selector: 'app-agent-inspector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './agent-inspector.component.html',
  styleUrl: './agent-inspector.component.scss',
})
export class AgentInspectorComponent {
  readonly inspector = inject(AgentInspectorService);
  readonly snapshot = this.inspector.latest;
  readonly trace = computed(() => this.snapshot()?.executionTrace ?? null);

  label(value: unknown): string { return value === true ? 'Yes' : value === false ? 'No' : String(value ?? 'NOT CURRENTLY OBSERVABLE'); }
  title(value: string): string { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
  semanticLabel(value?: string): string {
    return ({ SUCCESS: 'Completed', NO_DATA: 'No Data', ERROR: 'Error', PENDING: 'Awaiting Human Approval', APPROVED: 'Approved', REJECTED: 'Rejected', REFUSED: 'Refused' } as Record<string, string>)[value ?? ''] ?? 'Not Currently Observable';
  }
  entries(value?: Record<string, unknown>): Array<{ key: string; value: unknown }> {
    return value ? Object.entries(value).map(([key, item]) => ({ key, value: item })) : [];
  }
}
