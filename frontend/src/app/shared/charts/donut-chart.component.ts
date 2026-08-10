import { Component, Input, OnChanges } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

export interface DonutItem { l: string; v: number; c: string; }

@Component({
  selector: 'app-donut-chart',
  standalone: true,
  template: `<div [innerHTML]="svg"></div>`,
  styleUrl: './donut-chart.component.scss',
})
export class DonutChartComponent implements OnChanges {
  @Input() items: DonutItem[] = [];
  svg: SafeHtml = '';

  constructor(private sanitizer: DomSanitizer) {}

  ngOnChanges() {
    this.svg = this.sanitizer.bypassSecurityTrustHtml(this.render());
  }

  private esc(s: string): string {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
  }

  private render(): string {
    const items = this.items.filter(i => i.v > 0);
    const total = items.reduce((s, i) => s + i.v, 0);
    if (!total) return '<p class="note chart-empty">—</p>';

    const cx = 100, cy = 100, r = 70, stroke = 34;
    const circumference = 2 * Math.PI * r;
    let offset = 0;
    let arcs = '';
    items.forEach(it => {
      const frac = it.v / total;
      const len = frac * circumference;
      arcs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${it.c}" stroke-width="${stroke}"
        stroke-dasharray="${len} ${circumference - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"></circle>`;
      offset += len;
    });

    const legend = items.map(it => {
      const pct = Math.round((it.v / total) * 100);
      return `<div class="legend-row">
        <span class="legend-swatch" style="background:${it.c}"></span>
        <span>${this.esc(it.l)} — <b>${it.v}</b> (${pct}%)</span>
      </div>`;
    }).join('');

    return `<div class="chart-wrap">
      <svg class="chart-svg" viewBox="0 0 200 200">
        ${arcs}
        <text x="100" y="95" text-anchor="middle" font-size="26" font-weight="700" fill="var(--ink)">${total}</text>
        <text x="100" y="115" text-anchor="middle" font-size="11" fill="var(--muted)">total</text>
      </svg>
      <div>${legend}</div>
    </div>`;
  }
}
