import { Component, Input, OnChanges } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { I18nService } from '../../core/i18n.service';

export interface BarItem { l: string; v: number; c?: string; }

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  template: `<div [innerHTML]="svg"></div>`,
  styleUrl: './bar-chart.component.scss',
})
export class BarChartComponent implements OnChanges {
  @Input() items: BarItem[] = [];
  @Input() color = '#2d6ca8';
  svg: SafeHtml = '';

  constructor(private sanitizer: DomSanitizer, private i18n: I18nService) {}

  ngOnChanges() {
    this.svg = this.sanitizer.bypassSecurityTrustHtml(this.render());
  }

  private esc(s: string): string {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
  }

  private render(): string {
    const items = this.items;
    if (!items.length) return '<p class="note chart-empty">—</p>';
    const w = 560, h = 190, padL = 40, padB = 34, padT = 10;
    const max = Math.max(1, ...items.map(i => i.v));
    const bw = (w - padL - 8) / items.length;
    let bars = '', labels = '';
    items.forEach((it, i) => {
      const bh = (it.v / max) * (h - padT - padB);
      const x = padL + i * bw + bw * 0.14, y = h - padB - bh;
      bars += `<rect x="${x}" y="${y}" width="${bw * 0.72}" height="${Math.max(bh, it.v > 0 ? 2 : 0)}" rx="2.5" fill="${it.c || this.color}"></rect>`;
      if (it.v > 0) bars += `<text x="${x + bw * 0.36}" y="${y - 4}" text-anchor="middle" font-size="10" fill="#5b6b70">${it.v.toLocaleString(this.i18n.locale())}</text>`;
      const rot = items.length > 9 ? `rotate(-32 ${padL + i * bw + bw / 2} ${h - padB + 13})` : '';
      labels += `<text x="${padL + i * bw + bw / 2}" y="${h - padB + 13}" text-anchor="middle" font-size="10" fill="#8a979b" transform="${rot}">${this.esc(it.l)}</text>`;
    });
    return `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
      <line x1="${padL}" y1="${h - padB}" x2="${w - 4}" y2="${h - padB}" stroke="#dde3e2"/>
      ${bars}${labels}</svg>`;
  }
}
