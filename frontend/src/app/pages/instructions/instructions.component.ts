import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n.service';
import { ApiService } from '../../core/api.service';
import { NAV } from '../../core/nav.config';

@Component({
  selector: 'app-instructions',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './instructions.component.html',
  styleUrl: './instructions.component.scss',
})
export class InstructionsComponent implements OnInit {
  nav = NAV;
  purposeMap: Record<string, string> = {
    'Home': 'Central navigation hub, branding, quick links, mini KPI snapshot',
    'Instructions': 'User guide, color/status legend, sheet index, version notes',
    'Portfolio Dashboard': 'Live, all-projects executive overview',
    'Project Dashboard': 'Live, single-project view driven by a dropdown switcher',
    'Lists': 'Dropdown source lists and system settings',
    'Project Register': 'Master list of projects; anchor table for all project dropdowns',
  };
  legend: [string, string, string][] = [
    ['Green', 'Safe / compliant / valid / closed / pass', '#1e8a4c'],
    ['Amber', 'Caution / expiring soon / in progress / conditional pass', '#e0a010'],
    ['Red', 'Critical / overdue / expired / non-compliant / fail', '#c23a2b'],
    ['Light yellow cells', 'Unlocked data-entry cells', '#fdf3c2'],
    ['Light blue cells', 'Locked formula or system-calculated cells', '#d9e8f5'],
  ];
  purpose = 'This system is a multi-project HSE Management System aligned with common ISO 45001 and ISO 14001 management-system practice. Projects are rows in Project Register; dashboards and dropdowns read from those rows automatically.';
  howto = [
    '1. Open Project Register and add one new row with Project Code, Project Name and core details.',
    '2. Project dropdowns, dashboard selectors and calculations reference Project Register automatically — no extra setup needed.',
    '3. Add Manpower Log, incidents, actions, inspections and other records against the new Project Code. No duplication is needed.',
  ];
  switcher = "Project Dashboard switcher: use the highlighted dropdown at the top of Project Dashboard to change which project's data is shown.";
  admin = 'Assumptions applied: 5x5 risk matrix, RateBase 1,000,000, 30-day expiry warning, weekly scaffold inspection, monthly first-aid inspection, quarterly ladder inspection, and six-month audit/drill intervals. Settings can be changed on the Lists page.';

  totalSheets(): number {
    return this.nav.reduce((n, g) => n + g.items.length, 0);
  }

  constructor(public i18n: I18nService, private api: ApiService) {}

  ngOnInit() {
    this.api.getSheets().subscribe(sheets => {
      sheets.forEach(s => (this.purposeMap[s.sheet] = s.desc));
    });
  }
}
