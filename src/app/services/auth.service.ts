// auth.service.ts - SoundCloud OAuth 2.1 with PKCE
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, tap, switchMap } from 'rxjs/operators';
import { environment } from 'src/environments/environment.prod';
import { AuthToken, PKCEChallenge } from '../models';
import { ToastService } from './toast.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly clientId = environment.soundcloudClientId;
  private readonly clientSecret = environment.soundcloudClientSecret;
  private readonly redirectUri = `${environment.baseCallbackUrl}/callback`;
  private readonly authBaseUrl = environment.authBaseUrl;

  private accessToken$ = new BehaviorSubject<string | null>(null);
  private refreshToken$ = new BehaviorSubject<string | null>(null);
  private tokenExpiry$ = new BehaviorSubject<Date | null>(null);

  private readonly STORAGE_KEYS = {
    ACCESS_TOKEN: 'sc_access_token',
    REFRESH_TOKEN: 'sc_refresh_token',
    TOKEN_EXPIRY: 'sc_token_expiry',
    PKCE_VERIFIER: 'sc_pkce_verifier',
    PKCE_STATE: 'sc_pkce_state',
  };

  constructor(
    private http: HttpClient,
    private router: Router,
    private toastService: ToastService
  ) {
    this.loadStoredTokens();
  }

  // ==================== PKCE Generation ====================

  private async generatePKCEChallenge(): Promise<PKCEChallenge> {
    const codeVerifier = this.generateRandomString(128);
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);
    const state = this.generateRandomString(32);

    return { codeVerifier, codeChallenge, state };
  }

  private generateRandomString(length: number): string {
    const charset =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    return Array.from(randomValues)
      .map((x) => charset[x % charset.length])
      .join('');
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(digest));
  }

  private base64UrlEncode(buffer: Uint8Array): string {
    let binary = '';
    buffer.forEach((byte) => (binary += String.fromCharCode(byte)));
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  // ==================== Authentication Flow ====================

  async login(): Promise<void> {
    const pkce = await this.generatePKCEChallenge();

    // Store PKCE verifier and state for callback validation
    sessionStorage.setItem(this.STORAGE_KEYS.PKCE_VERIFIER, pkce.codeVerifier);
    sessionStorage.setItem(this.STORAGE_KEYS.PKCE_STATE, pkce.state);

    const authUrl = new URL(`${this.authBaseUrl}/authorize`);
    authUrl.searchParams.set('client_id', this.clientId);
    authUrl.searchParams.set('redirect_uri', this.redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('code_challenge', pkce.codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', pkce.state);

    window.location.href = authUrl.toString();
  }

  handleCallback(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      this.toastService.showNegativeToast(
        'Authentication failed. Please try again.'
      );
      this.router.navigate(['/home']);
      return;
    }

    // Validate state parameter
    const storedState = sessionStorage.getItem(this.STORAGE_KEYS.PKCE_STATE);
    if (!state || state !== storedState) {
      console.error('State mismatch - possible CSRF attack');
      this.toastService.showNegativeToast(
        'Security validation failed. Please try again.'
      );
      this.router.navigate(['/home']);
      return;
    }

    if (code) {
      this.exchangeCodeForToken(code);
    } else {
      this.toastService.showNegativeToast('No authorization code received.');
      this.router.navigate(['/home']);
    }
  }

  private exchangeCodeForToken(code: string): void {
    const codeVerifier = sessionStorage.getItem(
      this.STORAGE_KEYS.PKCE_VERIFIER
    );

    if (!codeVerifier) {
      console.error('No PKCE verifier found');
      this.toastService.showNegativeToast(
        'Authentication session expired. Please try again.'
      );
      this.router.navigate(['/home']);
      return;
    }

    const tokenUrl = `${this.authBaseUrl}/oauth/token`;
    const body = new URLSearchParams();
    body.set('grant_type', 'authorization_code');
    body.set('client_id', this.clientId);
    body.set('client_secret', this.clientSecret);
    body.set('redirect_uri', this.redirectUri);
    body.set('code_verifier', codeVerifier);
    body.set('code', code);

    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json; charset=utf-8',
    });

    this.http
      .post<AuthToken>(tokenUrl, body.toString(), { headers })
      .subscribe({
        next: (response) => {
          this.storeTokens(response);
          this.cleanupPKCE();
          console.log('Authentication successful');
          this.router.navigate(['/my-profile']);
        },
        error: (err) => {
          console.error('Token exchange failed:', err);
          this.toastService.showNegativeToast(
            'Login failed. Please try again.'
          );
          this.cleanupPKCE();
          this.router.navigate(['/home']);
        },
      });
  }

  // ==================== Token Management ====================

  private storeTokens(token: AuthToken): void {
    const expiry = new Date(Date.now() + token.expires_in * 1000);

    this.accessToken$.next(token.access_token);
    this.refreshToken$.next(token.refresh_token);
    this.tokenExpiry$.next(expiry);

    localStorage.setItem(this.STORAGE_KEYS.ACCESS_TOKEN, token.access_token);
    localStorage.setItem(this.STORAGE_KEYS.REFRESH_TOKEN, token.refresh_token);
    localStorage.setItem(this.STORAGE_KEYS.TOKEN_EXPIRY, expiry.toISOString());
  }

  private loadStoredTokens(): void {
    const accessToken = localStorage.getItem(this.STORAGE_KEYS.ACCESS_TOKEN);
    const refreshToken = localStorage.getItem(this.STORAGE_KEYS.REFRESH_TOKEN);
    const tokenExpiry = localStorage.getItem(this.STORAGE_KEYS.TOKEN_EXPIRY);

    if (accessToken && refreshToken && tokenExpiry) {
      const expiry = new Date(tokenExpiry);

      // Check if token is expired
      if (expiry > new Date()) {
        this.accessToken$.next(accessToken);
        this.refreshToken$.next(refreshToken);
        this.tokenExpiry$.next(expiry);
      } else {
        // Token expired, try to refresh
        this.attemptTokenRefresh();
      }
    }
  }

  refreshAccessToken(): Observable<AuthToken> {
    const refreshToken = this.refreshToken$.value;

    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    const tokenUrl = `${this.authBaseUrl}/oauth/token`;
    const body = new URLSearchParams();
    body.set('grant_type', 'refresh_token');
    body.set('client_id', this.clientId);
    body.set('client_secret', this.clientSecret);
    body.set('refresh_token', refreshToken);

    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json; charset=utf-8',
    });

    return this.http
      .post<AuthToken>(tokenUrl, body.toString(), { headers })
      .pipe(
        tap((response) => {
          this.storeTokens(response);
          console.log('Token refreshed successfully');
        }),
        catchError((error) => {
          console.error('Token refresh failed:', error);
          this.logout();
          return throwError(() => error);
        })
      );
  }

  private attemptTokenRefresh(): void {
    this.refreshAccessToken().subscribe({
      error: () => {
        // Refresh failed, clear tokens
        this.clearTokens();
      },
    });
  }

  private cleanupPKCE(): void {
    sessionStorage.removeItem(this.STORAGE_KEYS.PKCE_VERIFIER);
    sessionStorage.removeItem(this.STORAGE_KEYS.PKCE_STATE);
  }

  private clearTokens(): void {
    this.accessToken$.next(null);
    this.refreshToken$.next(null);
    this.tokenExpiry$.next(null);

    localStorage.removeItem(this.STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(this.STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(this.STORAGE_KEYS.TOKEN_EXPIRY);
  }

  // ==================== Public Methods ====================

  logout(): void {
    const accessToken = this.accessToken$.value;

    if (accessToken) {
      // Call SoundCloud sign-out endpoint
      this.http
        .post(`${this.authBaseUrl}/sign-out`, { access_token: accessToken })
        .subscribe({
          complete: () => console.log('Signed out from SoundCloud'),
          error: (err) => console.warn('Sign-out request failed:', err),
        });
    }

    this.clearTokens();
    this.router.navigate(['/home']);
  }

  getAccessToken(): string | null {
    return this.accessToken$.value;
  }

  getAccessToken$(): Observable<string | null> {
    return this.accessToken$.asObservable();
  }

  isLoggedIn(): boolean {
    const token = this.accessToken$.value;
    const expiry = this.tokenExpiry$.value;

    if (!token || !expiry) return false;

    // Check if token will expire in the next minute
    const expiryBuffer = new Date(Date.now() + 60000);
    return expiry > expiryBuffer;
  }

  isTokenExpiringSoon(): boolean {
    const expiry = this.tokenExpiry$.value;
    if (!expiry) return true;

    // Token expires in less than 5 minutes
    const expiryBuffer = new Date(Date.now() + 5 * 60 * 1000);
    return expiry < expiryBuffer;
  }

  // Get auth header for API requests
  getAuthHeaders(): HttpHeaders {
    const token = this.accessToken$.value;
    return new HttpHeaders({
      Authorization: `OAuth ${token}`,
      Accept: 'application/json; charset=utf-8',
    });
  }
}
