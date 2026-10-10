import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, Project } from '../../core/api.service';
import { I18nService } from '../../core/i18n.service';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss',
})
export class ProjectsComponent implements OnInit {
  projects: Project[] = [];
  constructor(public api: ApiService, public i18n: I18nService) {}
  ngOnInit() {
    this.api.getProjects().subscribe(p => (this.projects = p));
  }
}
