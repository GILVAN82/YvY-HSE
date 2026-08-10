import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ColumnMeta { name: string; header: string; type: 'TEXT'|'DATE'|'NUMERIC'; }
export interface TableMeta { title: string; db_table: string; columns: ColumnMeta[]; }
export interface SheetMeta { sheet: string; desc: string; tables: TableMeta[]; }
export interface Project {
  code: string; name: string; client: string; location: string; country_region: string;
  project_manager: string; hse_manager: string; project_type: string; status: string;
  start_date: string; planned_end_date: string; actual_end_date: string; notes: string;
}
export interface Kpi {
  project: string; month: number | '*'; rateBase: number; manHours: number;
  totalIncidents: number; recordableIncidents: number; lostTimeInjuries: number;
  trir: number | null; ltifr: number | null; openActions: number; overdueActions: number;
  activePermits: number; trainingCompliance: number | null; auditScoreAvg: number | null;
  daysSinceLTI: number | null;
}
export interface PagedResult<T = any> { total: number; page: number; pageSize: number; rows: T[]; }
export interface StatCard {
  label: string;
  value: number | string | null;
  tone?: 'g' | 'a' | 'r' | 'b';
  fmt?: 'int' | 'dec2' | 'pct' | 'date' | 'text';
  hint?: string;
  hintNum?: number;
}
export interface SheetStats { sheet: string; tableIndex: number; total: number; truncated: boolean; cards: StatCard[]; }

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getSheets(): Observable<SheetMeta[]> {
    return this.http.get<SheetMeta[]>(`${this.base}/sheets`);
  }

  getProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(`${this.base}/projects`);
  }

  getLists(): Observable<Record<string, Record<string, string[]>>> {
    return this.http.get<Record<string, Record<string, string[]>>>(`${this.base}/lists`);
  }

  getSettings(): Observable<{ named_range: string; value: string; used_for: string }[]> {
    return this.http.get<{ named_range: string; value: string; used_for: string }[]>(`${this.base}/settings`);
  }

  getKpi(project = '*', month: number | '*' = '*'): Observable<Kpi> {
    return this.http.get<Kpi>(`${this.base}/kpi`, { params: { project, month: String(month) } });
  }

  getData(sheet: string, tableIndex = 0, opts: Record<string, string> = {}): Observable<PagedResult> {
    return this.http.get<PagedResult>(`${this.base}/data/${encodeURIComponent(sheet)}/${tableIndex}`, { params: opts });
  }

  /** KPI cards for a sheet page — takes the same filters as getData() so both agree. */
  getStats(sheet: string, tableIndex = 0, opts: Record<string, string> = {}): Observable<SheetStats> {
    return this.http.get<SheetStats>(`${this.base}/stats/${encodeURIComponent(sheet)}/${tableIndex}`, { params: opts });
  }

  addRow(sheet: string, tableIndex: number, row: Record<string, any>): Observable<any> {
    return this.http.post(`${this.base}/data/${encodeURIComponent(sheet)}/${tableIndex}`, row);
  }

  updateRow(sheet: string, tableIndex: number, id: number, row: Record<string, any>): Observable<any> {
    return this.http.put(`${this.base}/data/${encodeURIComponent(sheet)}/${tableIndex}/${id}`, row);
  }

  deleteRow(sheet: string, tableIndex: number, id: number): Observable<any> {
    return this.http.delete(`${this.base}/data/${encodeURIComponent(sheet)}/${tableIndex}/${id}`);
  }
}
