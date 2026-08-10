import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService, Kpi, Project } from '../../core/api.service';
import { I18nService } from '../../core/i18n.service';
import { BarChartComponent, BarItem } from '../../shared/charts/bar-chart.component';
import { LineChartComponent, LineSeries } from '../../shared/charts/line-chart.component';
import { DonutChartComponent, DonutItem } from '../../shared/charts/donut-chart.component';

// The 4 Portfolio Dashboard charts:
// "Incidents by Project" (bar), "Incident Trend - All Projects" (line),
// "Severity Breakdown" (doughnut), "High/Critical Actions" (bar).
@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CommonModule, RouterLink, BarChartComponent, LineChartComponent, DonutChartComponent],
  templateUrl: './portfolio.component.html',
  styleUrl: './portfolio.component.scss',
})
export class PortfolioComponent implements OnInit {
  kpi?: Kpi;
  projects: Project[] = [];
  perProjectKpi: Record<string, Kpi> = {};

  incByProject: BarItem[] = [];
  incidentTrend: LineSeries[] = [];
  severityDonut: DonutItem[] = [];
  highCriticalActions: BarItem[] = [];

  constructor(public api: ApiService, public i18n: I18nService) {}

  ngOnInit() {
    this.api.getKpi('*', '*').subscribe(k => (this.kpi = k));
    this.api.getProjects().subscribe(projects => {
      this.projects = projects;
      projects.forEach(p => {
        this.api.getKpi(p.code, '*').subscribe(k => (this.perProjectKpi[p.code] = k));
      });
      this.loadCharts();
    });
  }

  private loadCharts() {
    forkJoin({
      incidents: this.api.getData('Incident Register', 0, { pageSize: '500' }),
      actions: this.api.getData('Action Tracker (CAPA)', 0, { pageSize: '500' }),
    }).subscribe(({ incidents, actions }) => {
      // Chart 1: Incidents by Project
      const byPrj: Record<string, number> = {};
      incidents.rows.forEach(r => { const p = r['project_code']; if (p) byPrj[p] = (byPrj[p] || 0) + 1; });
      this.incByProject = Object.entries(byPrj).map(([l, v]) => ({ l, v }));

      // Chart 2: Incident Trend - All Projects (monthly count, 2026)
      const monthly = Array(12).fill(0);
      incidents.rows.forEach(r => {
        const d = r['date_of_incident'] ? new Date(r['date_of_incident']) : null;
        if (d && !isNaN(d.getTime())) monthly[d.getUTCMonth()] += 1;
      });
      this.incidentTrend = [{ name: this.i18n.t('Incidents'), color: '#c23a2b', vals: monthly }];

      // Chart 3: Severity Breakdown (doughnut)
      const bySev: Record<string, number> = {};
      incidents.rows.forEach(r => { const s = r['severity']; if (s) bySev[s] = (bySev[s] || 0) + 1; });
      const sevOrder = ['1 - Negligible', '2 - Minor', '3 - Moderate', '4 - Major', '5 - Catastrophic'];
      const sevColors: Record<string, string> = { '1 - Negligible': '#1e8a4c', '2 - Minor': '#5aa876', '3 - Moderate': '#e0a010', '4 - Major': '#d9701f', '5 - Catastrophic': '#c23a2b' };
      this.severityDonut = sevOrder.filter(s => bySev[s]).map(s => ({ l: this.i18n.t(s), v: bySev[s], c: sevColors[s] }));

      // Chart 4: High/Critical Actions by Project (any status, Priority = High or Critical)
      const actByPrj: Record<string, number> = {};
      actions.rows.forEach(r => {
        if (r['priority'] === 'High' || r['priority'] === 'Critical') {
          const p = r['project'];
          if (p) actByPrj[p] = (actByPrj[p] || 0) + 1;
        }
      });
      this.highCriticalActions = Object.entries(actByPrj).map(([l, v]) => ({ l, v, c: '#c23a2b' }));
    });
  }

  rag(v: number | null, good: boolean, ok: boolean): 'g' | 'a' | 'r' {
    if (v === null) return 'a';
    if (good) return 'g';
    if (ok) return 'a';
    return 'r';
  }
}
