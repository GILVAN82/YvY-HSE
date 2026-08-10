import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService, SheetMeta, TableMeta, PagedResult, Project, SheetStats, StatCard } from '../../core/api.service';
import { I18nService } from '../../core/i18n.service';

// Status legend (BADGE.g/a/r) — see Instructions page for the color/status legend.
const BADGE_G = new Set(['Closed','Completed','Active','Valid','Pass','Compliant','Yes','Safe Behavior','Low','Approved','Good']);
const BADGE_A = new Set(['In Progress','Open','Planned','Pending','Conditional Pass','Expiring Soon','Medium','On Hold','Under Review','Delayed','Caution']);
const BADGE_R = new Set(['Overdue','Expired','Fail','Non-Compliant','Extreme','High','Cancelled','Rejected','Unsafe Behavior','Unsafe Condition','Suspended']);
const BADGE_COL_RE = /status|result|priority|risk|level|type|behavior|check|classification|compliance/i;

interface TableState {
  result?: PagedResult;
  stats?: SheetStats;
  q: string;
  projectFilter: string;
  statusFilter: string;
  page: number;
}

@Component({
  selector: 'app-sheet',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sheet.component.html',
  styleUrl: './sheet.component.scss',
})
export class SheetComponent implements OnInit {
  sheetName = '';
  meta?: SheetMeta;
  tableStates: TableState[] = [];
  projects: Project[] = [];
  showModal = false;
  modalTableIndex = 0;
  newRow: Record<string, any> = {};
  lists: Record<string, Record<string, string[]>> = {};
  pageSize = 50;

  constructor(public api: ApiService, public i18n: I18nService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.api.getProjects().subscribe(p => (this.projects = p));
    this.api.getLists().subscribe(l => (this.lists = l));
    this.route.paramMap.subscribe(params => {
      this.sheetName = params.get('sheet') || '';
      this.loadMeta();
    });
  }

  loadMeta() {
    this.api.getSheets().subscribe(sheets => {
      this.meta = sheets.find(s => s.sheet === this.sheetName);
      this.tableStates = (this.meta?.tables || []).map(() => ({ q: '', projectFilter: '', statusFilter: '', page: 1 }));
      this.loadAllTables();
    });
  }

  loadAllTables() {
    this.meta?.tables.forEach((_, ti) => this.loadTable(ti));
  }

  loadTable(ti: number) {
    const st = this.tableStates[ti];
    if (!st) return;
    const filters: Record<string, string> = {};
    if (ti === 0) {
      if (st.q) filters['q'] = st.q;
      if (st.projectFilter) filters['project'] = st.projectFilter;
      if (st.statusFilter) filters['status'] = st.statusFilter;
    }
    const opts = { ...filters, page: String(st.page), pageSize: String(this.pageSize) };
    this.api.getData(this.sheetName, ti, opts).subscribe(r => (st.result = r));
    // Same filters, no pagination: the cards summarise the whole filtered set, not just this page.
    this.api.getStats(this.sheetName, ti, filters).subscribe(s => (st.stats = s));
  }

  onFilterChange(ti: number) {
    this.tableStates[ti].page = 1;
    this.loadTable(ti);
  }

  statusColumn(t: TableMeta): string | undefined {
    return t.columns.find(c => c.name.includes('status'))?.name;
  }
  projectColumn(t: TableMeta): string | undefined {
    return t.columns.find(c => /^project(_code)?$/.test(c.name))?.name;
  }
  distinctStatuses(ti: number, t: TableMeta): string[] {
    const col = this.statusColumn(t);
    const res = this.tableStates[ti]?.result;
    if (!col || !res) return [];
    return [...new Set(res.rows.map(r => r[col]).filter(Boolean))];
  }

  isBadgeColumn(t: TableMeta, colName: string): boolean {
    return BADGE_COL_RE.test(colName) || BADGE_COL_RE.test(t.columns.find(c => c.name === colName)?.header || '');
  }
  badgeClass(v: any): string {
    const s = String(v);
    if (BADGE_G.has(s)) return 'g';
    if (BADGE_R.has(s)) return 'r';
    if (BADGE_A.has(s)) return 'a';
    if (/^PRJ-\d+/.test(s)) return 'b';
    return 'n';
  }

  isNumericCol(t: TableMeta, name: string): boolean {
    return t.columns.find(c => c.name === name)?.type === 'NUMERIC';
  }
  isDateCol(t: TableMeta, name: string): boolean {
    return t.columns.find(c => c.name === name)?.type === 'DATE';
  }

  fmtCell(v: any, t: TableMeta, colName: string): string {
    if (v === null || v === undefined || v === '') return '';
    if (this.isDateCol(t, colName)) {
      const d = new Date(v);
      return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString(this.i18n.locale(), { day: '2-digit', month: 'short', year: 'numeric' });
    }
    if (this.isNumericCol(t, colName)) {
      const n = Number(v);
      return isNaN(n) ? String(v) : n.toLocaleString(this.i18n.locale());
    }
    return this.i18n.t(String(v));
  }

  /** Renders a KPI card value according to the `fmt` the backend assigned it. */
  fmtStat(card: StatCard): string {
    const v = card.value;
    if (v === null || v === undefined) return '—';
    const loc = this.i18n.locale();
    switch (card.fmt) {
      case 'pct':
        return (Number(v) * 100).toLocaleString(loc, { maximumFractionDigits: 0 }) + '%';
      case 'dec2':
        return Number(v).toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      case 'date': {
        const d = new Date(String(v));
        return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString(loc, { day: '2-digit', month: 'short', year: 'numeric' });
      }
      case 'int':
        return Number(v).toLocaleString(loc, { maximumFractionDigits: 0 });
      default:
        return this.i18n.t(String(v));
    }
  }

  openAdd(ti: number) {
    this.modalTableIndex = ti;
    this.newRow = {};
    this.showModal = true;
  }
  closeModal() {
    this.showModal = false;
  }
  save() {
    const t = this.meta?.tables[this.modalTableIndex];
    if (!t) return;
    this.api.addRow(this.sheetName, this.modalTableIndex, this.newRow).subscribe(() => {
      this.closeModal();
      this.loadTable(this.modalTableIndex);
    });
  }
  remove(ti: number, id: number) {
    this.api.deleteRow(this.sheetName, ti, id).subscribe(() => this.loadTable(ti));
  }

  // field-type inference for the "add record" modal — mirrors the original app's openAdd()
  fieldKind(h: string, colType: string, colName: string): 'project' | 'date' | 'severity' | 'status' | 'textarea' | 'number' | 'text' {
    if (/^project( code)?$/i.test(h)) return 'project';
    if (colType === 'DATE') return 'date';
    if (/severity/i.test(h) && this.lists['Observation / PPE / Training / Audit / Waste Lists']?.['Severity']) return 'severity';
    if (colName.includes('status') && this.statusListOptions().length) return 'status';
    if (/description|remarks|comments|observations|scope|agenda|discussion/i.test(h)) return 'textarea';
    if (colType === 'NUMERIC') return 'number';
    return 'text';
  }
  severityOptions(): string[] {
    let opts: string[] = [];
    for (const g of Object.values(this.lists)) { if (g['Severity']) opts = g['Severity']; }
    return opts;
  }
  statusListOptions(): string[] {
    let opts: string[] = [];
    for (const g of Object.values(this.lists)) { if (g['Status']) opts = g['Status']; }
    return opts;
  }

  exportCSV(ti: number) {
    const t = this.meta?.tables[ti];
    const res = this.tableStates[ti]?.result;
    if (!t || !res) return;
    const headers = t.columns.map(c => c.header);
    const rows = res.rows.map(r => t.columns.map(c => r[c.name]));
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = this.sheetName.replace(/[^\w]+/g, '_') + '.csv';
    a.click();
  }
}
