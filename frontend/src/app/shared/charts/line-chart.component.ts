import { Component, Input, OnChanges } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { I18nService } from '../../core/i18n.service';

export interface LineSeries { name: string; color: string; vals: number[]; }

const MONTH_LBL: Record<string, string[]> = {
  en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  pt: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'],
  es: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
  fr: ['Janv','Févr','Mars','Avr','Mai','Juin','Juil','Août','Sept','Oct','Nov','Déc'],
  de: ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'],
};

@Component({
  selector: 'app-line-chart',
  standalone: true,
  templateUrl: './line-chart.component.html',
  styleUrl: './line-chart.component.scss',
})
export class LineChartComponent implements OnChanges {
  @Input() series: LineSeries[] = [];
  svg: SafeHtml = '';

  constructor(private sanitizer: DomSanitizer, private i18n: I18nService) {}

  ngOnChanges() {
    this.svg = this.sanitizer.bypassSecurityTrustHtml(this.render());
  }

  private esc(s: string): string {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
  }

  private fmtN(v: number): string {
    return Math.round(v).toLocaleString(this.i18n.locale());
  }

  private render(): string {
    const series = this.series;
    if (!series.length) return '<p class="note chart-empty">—</p>';
    const w = 560, h = 200, padL = 46, padB = 26, padT = 12;
    const max = Math.max(1, ...series.flatMap(s => s.vals));
    const x = (i: number) => padL + i * (w - padL - 10) / 11;
    const y = (v: number) => h - padB - (v / max) * (h - padT - padB);
    let g = '';
    [0, 0.5, 1].forEach(f => {
      g += `<line x1="${padL}" y1="${y(max * f)}" x2="${w - 6}" y2="${y(max * f)}" stroke="#edf0ef"/><text x="${padL - 5}" y="${y(max * f) + 3}" text-anchor="end" font-size="10" fill="#8a979b">${this.fmtN(max * f)}</text>`;
    });
    series.forEach(s => {
      const pts = s.vals.map((v, i) => `${x(i)},${y(v)}`).join(' ');
      g += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.2"/>`;
      s.vals.forEach((v, i) => { g += `<circle cx="${x(i)}" cy="${y(v)}" r="2.6" fill="${s.color}"/>`; });
    });
    const months = MONTH_LBL[this.i18n.lang()] || MONTH_LBL['en'];
    months.forEach((m, i) => { g += `<text x="${x(i)}" y="${h - 8}" text-anchor="middle" font-size="10" fill="#8a979b">${m}</text>`; });
    const legend = series.map(s => `<span class="legend-item"><svg class="legend-dot" viewBox="0 0 10 10" aria-hidden="true"><rect width="10" height="10" rx="2" fill="${s.color}"></rect></svg>${this.esc(s.name)}</span>`).join('');
    return `<div class="chart-legend">${legend}</div><svg class="chart-svg" viewBox="0 0 ${w} ${h}">${g}</svg>`;
  }
}
