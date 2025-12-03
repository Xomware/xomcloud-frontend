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
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    const isLoggedIn = this.authService.isLoggedIn();

    // If user is not logged in and trying to access protected routes
    if (!isLoggedIn && state.url !== '/home') {
      console.log('Access denied - redirecting to home');
      this.router.navigate(['/home']);
      return false;
    }

    // If user is logged in and trying to access home, redirect to profile
    if (isLoggedIn && state.url === '/home') {
      this.router.navigate(['/my-profile']);
      return false;
    }

    return true;
  }
}
