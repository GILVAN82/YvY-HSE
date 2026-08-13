import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { PortfolioComponent } from './pages/portfolio/portfolio.component';
import { ProjectComponent } from './pages/project/project.component';
import { ProjectsComponent } from './pages/projects/projects.component';
import { ListsComponent } from './pages/lists/lists.component';
import { InstructionsComponent } from './pages/instructions/instructions.component';
import { SheetComponent } from './pages/sheet/sheet.component';
import { AgentInspectorComponent } from './pages/agent-inspector/agent-inspector.component';
import { LoginComponent } from './pages/login/login.component';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', canActivateChild: [authGuard], children: [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: 'home', component: HomeComponent },
  { path: 'instructions', component: InstructionsComponent },
  { path: 'agent-inspector', component: AgentInspectorComponent },
  { path: 'portfolio', component: PortfolioComponent },
  { path: 'project', component: ProjectComponent },
  { path: 'projects', component: ProjectsComponent },
  { path: 'lists', component: ListsComponent },
  { path: 'sheet/:sheet', component: SheetComponent },
  ]},
  { path: '**', redirectTo: 'home' },
];
