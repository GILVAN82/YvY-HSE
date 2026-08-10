import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/api.service';
import { I18nService } from '../../core/i18n.service';

@Component({
  selector: 'app-lists',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lists.component.html',
  styleUrl: './lists.component.scss',
})
export class ListsComponent implements OnInit {
  groups: Record<string, Record<string, string[]>> = {};
  settings: { named_range: string; value: string; used_for: string }[] = [];

  constructor(public api: ApiService, public i18n: I18nService) {}

  ngOnInit() {
    this.api.getLists().subscribe(g => (this.groups = g));
    this.api.getSettings().subscribe(s => (this.settings = s));
  }

  objKeys(o: any) {
    return Object.keys(o || {});
  }
}
