import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({ selector: 'app-login', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './login.component.html', styleUrl: './login.component.scss' })
export class LoginComponent {
  email = ''; password = ''; loading = signal(false); error = signal('');
  constructor(private readonly auth: AuthService, private readonly router: Router, private readonly route: ActivatedRoute) {}
  async submit() {
    if (this.loading()) return;
    this.loading.set(true); this.error.set('');
    try {
      if (!await this.auth.login(this.email, this.password)) { this.error.set('Invalid email or password.'); return; }
      const target = this.route.snapshot.queryParamMap.get('returnUrl');
      await this.router.navigateByUrl(target?.startsWith('/') ? target : '/home');
    } catch { this.error.set('Authentication is temporarily unavailable.'); }
    finally { this.loading.set(false); }
  }
}
