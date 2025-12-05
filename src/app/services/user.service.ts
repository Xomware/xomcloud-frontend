// user.service.ts - SoundCloud User API Service
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { User } from '../models';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly apiBaseUrl = environment.apiBaseUrl;
  private currentUser$ = new BehaviorSubject<User | null>(null);

  constructor(private http: HttpClient, private authService: AuthService) {}

  // ==================== Current User ====================

  getCurrentUser(): Observable<User> {
    const cachedUser = this.currentUser$.value;

    if (cachedUser) {
      return of(cachedUser);
    }

    return this.fetchCurrentUser();
  }

  fetchCurrentUser(): Observable<User> {
    return this.http
      .get<User>(`${this.apiBaseUrl}/me`, {
        headers: this.authService.getAuthHeaders(),
      })
      .pipe(
        tap((user) => {
          this.currentUser$.next(user);
          console.log('User profile loaded:', user.username);
        }),
        catchError((error) => {
          console.error('Failed to fetch user profile:', error);
          return throwError(() => error);
        })
      );
  }

  getCurrentUser$(): Observable<User | null> {
    return this.currentUser$.asObservable();
  }

  getUserId(): number | null {
    return this.currentUser$.value?.id ?? null;
  }
  getUsername(): string | null {
    return this.currentUser$.value?.username ?? null;
  }

  clearUserCache(): void {
    this.currentUser$.next(null);
  }

  // ==================== User Lookups ====================

  getUserById(userId: number): Observable<User> {
    return this.http
      .get<User>(`${this.apiBaseUrl}/users/${userId}`, {
        headers: this.authService.getAuthHeaders(),
      })
      .pipe(
        catchError((error) => {
          console.error(`Failed to fetch user ${userId}:`, error);
          return throwError(() => error);
        })
      );
  }

  getUserByPermalink(permalink: string): Observable<User> {
    return this.http
      .get<any>(`${this.apiBaseUrl}/resolve`, {
        headers: this.authService.getAuthHeaders(),
        params: { url: `https://soundcloud.com/${permalink}` },
      })
      .pipe(
        catchError((error) => {
          console.error(
            `Failed to resolve user permalink ${permalink}:`,
            error
          );
          return throwError(() => error);
        })
      );
  }

  // ==================== Followings ====================

  getFollowings(userId?: number, limit: number = 50): Observable<User[]> {
    const id = userId ?? this.currentUser$.value?.id;

    if (!id) {
      return throwError(() => new Error('No user ID available'));
    }

    return this.http
      .get<{ collection: User[] }>(
        `${this.apiBaseUrl}/users/${id}/followings`,
        {
          headers: this.authService.getAuthHeaders(),
          params: {
            limit: limit.toString(),
            linked_partitioning: 'true',
          },
        }
      )
      .pipe(
        map((response) => response.collection),
        catchError((error) => {
          console.error('Failed to fetch followings:', error);
          return throwError(() => error);
        })
      );
  }

  getFollowers(userId?: number, limit: number = 50): Observable<User[]> {
    const id = userId ?? this.currentUser$.value?.id;

    if (!id) {
      return throwError(() => new Error('No user ID available'));
    }

    return this.http
      .get<{ collection: User[] }>(`${this.apiBaseUrl}/users/${id}/followers`, {
        headers: this.authService.getAuthHeaders(),
        params: {
          limit: limit.toString(),
          linked_partitioning: 'true',
        },
      })
      .pipe(
        map((response) => response.collection),
        catchError((error) => {
          console.error('Failed to fetch followers:', error);
          return throwError(() => error);
        })
      );
  }

  followUser(userId: number): Observable<any> {
    return this.http
      .put(`${this.apiBaseUrl}/me/followings/${userId}`, null, {
        headers: this.authService.getAuthHeaders(),
      })
      .pipe(
        tap(() => console.log(`Now following user ${userId}`)),
        catchError((error) => {
          console.error(`Failed to follow user ${userId}:`, error);
          return throwError(() => error);
        })
      );
  }

  unfollowUser(userId: number): Observable<any> {
    return this.http
      .delete(`${this.apiBaseUrl}/me/followings/${userId}`, {
        headers: this.authService.getAuthHeaders(),
      })
      .pipe(
        tap(() => console.log(`Unfollowed user ${userId}`)),
        catchError((error) => {
          console.error(`Failed to unfollow user ${userId}:`, error);
          return throwError(() => error);
        })
      );
  }

  // ==================== User Stats ====================

  getUserPlaylists(userId: number, limit: number = 50): Observable<any[]> {
    return this.http
      .get<{ collection: any[] }>(
        `${this.apiBaseUrl}/users/${userId}/playlists`,
        {
          headers: this.authService.getAuthHeaders(),
          params: {
            limit: limit.toString(),
            linked_partitioning: 'true',
          },
        }
      )
      .pipe(
        map((response) => response.collection || []),
        catchError((error) => {
          console.error(`Failed to fetch playlists for user ${userId}:`, error);
          return throwError(() => error);
        })
      );
  }

  getUserStats(userId?: number): Observable<{
    tracks: number;
    playlists: number;
    followers: number;
    followings: number;
    likes: number;
  }> {
    const id = userId ?? this.currentUser$.value?.id;

    if (!id) {
      return throwError(() => new Error('No user ID available'));
    }

    return this.getUserById(id).pipe(
      map((user) => ({
        tracks: user.track_count,
        playlists: user.playlist_count,
        followers: user.followers_count,
        followings: user.followings_count,
        likes: user.likes_count ?? user.public_favorites_count,
      }))
    );
  }
}
