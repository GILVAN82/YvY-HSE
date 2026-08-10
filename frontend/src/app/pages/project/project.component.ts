import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService, Kpi, Project } from '../../core/api.service';
import { I18nService } from '../../core/i18n.service';
import { LineChartComponent, LineSeries } from '../../shared/charts/line-chart.component';
import { DonutChartComponent, DonutItem } from '../../shared/charts/donut-chart.component';
import { BarChartComponent, BarItem } from '../../shared/charts/bar-chart.component';

const BADGE_G = new Set(['Closed','Completed','Active','Valid','Pass','Compliant','Yes','Safe Behavior','Low','Approved','Good']);
const BADGE_A = new Set(['In Progress','Open','Planned','Pending','Conditional Pass','Expiring Soon','Medium','On Hold','Under Review','Delayed','Caution']);
const BADGE_R = new Set(['Overdue','Expired','Fail','Non-Compliant','Extreme','High','Cancelled','Rejected','Unsafe Behavior','Unsafe Condition','Suspended']);
const TRADES = ['Civil', 'Mechanical', 'Electrical', 'HSE', 'Operations', 'Logistics'];
const STATUS_COLORS: Record<string, string> = { Open: '#e0a010', 'In Progress': '#2d6ca8', Closed: '#1e8a4c', Overdue: '#c23a2b' };

// The 4 Project Dashboard charts:
// "Incident Trend - Selector Controlled" (line), "Action Status - Live" (doughnut),
// "Training Compliance by Trade" (bar), "Inspection Score Trend" (line).
@Component({
  selector: 'app-project',
  standalone: true,
  imports: [CommonModule, FormsModule, LineChartComponent, DonutChartComponent, BarChartComponent],
  templateUrl: './project.component.html',
  styleUrl: './project.component.scss',
})
export class ProjectComponent implements OnInit {
  projects: Project[] = [];
  selected = '*';
  month: number | '*' = '*';
  kpi?: Kpi;
  months = Array.from({ length: 12 }, (_, i) => i);
  monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  incidentTrend: LineSeries[] = [];
  actionStatusDonut: DonutItem[] = [];
  trainingByTrade: BarItem[] = [];
  inspectionScoreTrend: LineSeries[] = [];
  openActions: any[] = [];
  incidentRows: any[] = [];

  constructor(public api: ApiService, public i18n: I18nService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.queryParams.subscribe(p => {
      if (p['project']) this.selected = p['project'];
      this.refresh();
    });
    this.api.getProjects().subscribe(p => (this.projects = p));
  }

  refresh() {
    this.api.getKpi(this.selected, this.month).subscribe(k => (this.kpi = k));
    this.loadDetail();
  }

  private monthRange(): [Date, Date] {
    if (this.month === '*') return [new Date(2026, 0, 1), new Date(2026, 11, 31)];
    const m = this.month as number;
    return [new Date(2026, m, 1), new Date(2026, m + 1, 0)];
  }

  private loadDetail() {
    const projOpt: Record<string, string> = this.selected !== '*' ? { project: this.selected } : {};
    forkJoin({
      incidents: this.api.getData('Incident Register', 0, { pageSize: '500', ...projOpt }),
      actions: this.api.getData('Action Tracker (CAPA)', 0, { pageSize: '500', ...projOpt }),
      training: this.api.getData('Training & Competency', 0, { pageSize: '500', ...projOpt }),
      inspections: this.api.getData('Site Inspection', 0, { pageSize: '500', ...projOpt }),
    }).subscribe(({ incidents, actions, training, inspections }) => {
      // Incident Trend - Selector Controlled
      const inc = Array(12).fill(0);
      incidents.rows.forEach(r => {
        const d = r['date_of_incident'] ? new Date(r['date_of_incident']) : null;
        if (d && !isNaN(d.getTime())) inc[d.getUTCMonth()] += 1;
      });
      this.incidentTrend = [{ name: this.i18n.t('Incidents'), color: '#c23a2b', vals: inc }];

      // Action Status - Live (within selected month window, by Target Date)
      const [start, end] = this.monthRange();
      const statusCounts: Record<string, number> = { Open: 0, 'In Progress': 0, Closed: 0, Overdue: 0 };
      actions.rows.forEach(r => {
        const td = r['target_date'] ? new Date(r['target_date']) : null;
        if (!td || td < start || td > end) return;
        const computed = (r['status'] !== 'Closed' && td < new Date()) ? 'Overdue' : r['status'];
        if (computed in statusCounts) statusCounts[computed]++;
      });
      this.actionStatusDonut = Object.entries(statusCounts)
        .filter(([, v]) => v > 0)
        .map(([l, v]) => ({ l: this.i18n.t(l), v, c: STATUS_COLORS[l] }));

      // Training Compliance by Trade
      this.trainingByTrade = TRADES.map(trade => {
        const rows = training.rows.filter(r => r['traderole'] === trade && r['status']);
        const valid = rows.filter(r => r['status'] === 'Valid').length;
        const pct = rows.length ? Math.round((valid / rows.length) * 100) : 0;
        return { l: this.i18n.t(trade), v: pct, c: pct >= 90 ? '#1e8a4c' : (pct >= 70 ? '#e0a010' : '#c23a2b') };
      });

      // Inspection Score Trend
      const scoreSum = Array(12).fill(0), scoreCount = Array(12).fill(0);
      inspections.rows.forEach(r => {
        const d = r['date'] ? new Date(r['date']) : null;
        const s = Number(r['score']);
        if (d && !isNaN(d.getTime()) && !isNaN(s)) { scoreSum[d.getUTCMonth()] += s; scoreCount[d.getUTCMonth()]++; }
      });
      const avgScore = scoreSum.map((s, i) => (scoreCount[i] ? +(s / scoreCount[i]).toFixed(2) : 0));
      this.inspectionScoreTrend = [{ name: this.i18n.t('Score'), color: '#2d6ca8', vals: avgScore }];

      // Open actions list + incidents table (existing behavior)
      this.openActions = actions.rows
        .filter(r => r['status'] !== 'Closed')
        .map(r => ({ ...r, computed: (r['target_date'] && new Date(r['target_date']) < new Date()) ? 'Overdue' : r['status'] }));
      this.incidentRows = incidents.rows
        .filter(r => this.month === '*' || (r['date_of_incident'] && new Date(r['date_of_incident']).getUTCMonth() === this.month))
        .sort((a, b) => String(b['date_of_incident']).localeCompare(String(a['date_of_incident'])));
    });
  }

  get selectedProject(): Project | undefined {
    return this.projects.find(p => p.code === this.selected);
  }

  fmtDate(v: any): string {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString(this.i18n.locale(), { day: '2-digit', month: 'short', year: 'numeric' });
  }

  severityBadge(sev: string): string {
    const map: Record<string, string> = { '1': 'g', '2': 'g', '3': 'a', '4': 'r', '5': 'r' };
    return map[(sev || '')[0]] || 'n';
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
