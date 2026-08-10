import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { PortfolioComponent } from './pages/portfolio/portfolio.component';
import { ProjectComponent } from './pages/project/project.component';
import { ProjectsComponent } from './pages/projects/projects.component';
import { ListsComponent } from './pages/lists/lists.component';
import { InstructionsComponent } from './pages/instructions/instructions.component';
import { SheetComponent } from './pages/sheet/sheet.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: 'home', component: HomeComponent },
  { path: 'instructions', component: InstructionsComponent },
  { path: 'portfolio', component: PortfolioComponent },
  { path: 'project', component: ProjectComponent },
  { path: 'projects', component: ProjectsComponent },
  { path: 'lists', component: ListsComponent },
  { path: 'sheet/:sheet', component: SheetComponent },
  { path: '**', redirectTo: 'home' },
];
