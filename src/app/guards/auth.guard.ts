// auth.guard.ts - Route protection guard
import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    _next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    const isLoggedIn = this.authService.isLoggedIn();

    if (!isLoggedIn && state.url !== '/home') {
      this.router.navigate(['/home']);
      return false;
    }

    if (isLoggedIn && state.url === '/home') {
      this.router.navigate(['/my-profile']);
      return false;
    }

    return true;
  }
}
