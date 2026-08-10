import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, Kpi, Project } from '../../core/api.service';
import { I18nService } from '../../core/i18n.service';

const BADGE_G = new Set(['Closed','Completed','Active','Valid','Pass','Compliant','Yes','Safe Behavior','Low','Approved','Good']);
const BADGE_A = new Set(['In Progress','Open','Planned','Pending','Conditional Pass','Expiring Soon','Medium','On Hold','Under Review','Delayed','Caution']);
const BADGE_R = new Set(['Overdue','Expired','Fail','Non-Compliant','Extreme','High','Cancelled','Rejected','Unsafe Behavior','Unsafe Condition','Suspended']);

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  kpi?: Kpi;
  projects: Project[] = [];
  recentIncidents: any[] = [];
  recentActions: any[] = [];
  recentPermits: any[] = [];

  quickLinks = [
    { route: '/portfolio', icon: '▣', label: 'Portfolio Dashboard' },
    { route: '/project', icon: '▶', label: 'Project Dashboard' },
    { route: '/sheet/Incident Register', icon: '⚠', label: 'Incidents' },
    { route: '/sheet/Permit to Work Register', icon: '⚑', label: 'Permits' },
    { route: '/sheet/Action Tracker (CAPA)', icon: '✓', label: 'Actions' },
    { route: '/sheet/Training & Competency', icon: '△', label: 'Training' },
    { route: '/sheet/Audit Tracker', icon: '▥', label: 'Audits' },
    { route: '/sheet/Emergency Preparedness', icon: '⛑', label: 'Emergency' },
  ];

  constructor(public api: ApiService, public i18n: I18nService) {}

  ngOnInit() {
    this.api.getKpi('*', '*').subscribe(k => (this.kpi = k));
    this.api.getProjects().subscribe(p => (this.projects = p));

    this.api.getData('Incident Register', 0, { pageSize: '8' }).subscribe(r => (this.recentIncidents = r.rows));
    this.api.getData('Action Tracker (CAPA)', 0, { pageSize: '8' }).subscribe(r => (this.recentActions = r.rows));
    this.api.getData('Permit to Work Register', 0, { pageSize: '8' }).subscribe(r => (this.recentPermits = r.rows));
  }

  activeCount(): number {
    return this.projects.filter(p => p.status === 'Active').length;
  }

  badgeClass(v: any): string {
    const s = String(v);
    if (BADGE_G.has(s)) return 'g';
    if (BADGE_R.has(s)) return 'r';
    if (BADGE_A.has(s)) return 'a';
    if (/^PRJ-\d+/.test(s)) return 'b';
    return 'n';
  }
}
