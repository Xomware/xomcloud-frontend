// track.service.ts - SoundCloud Track API Service
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { Track, TrackCollection, LikedTrack, LikedTrackCollection } from '../models';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class TrackService {
  private readonly apiBaseUrl = environment.apiBaseUrl;
  
  // Cache for liked tracks
  private likedTracks$ = new BehaviorSubject<Track[]>([]);
  private userTracks$ = new BehaviorSubject<Track[]>([]);

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  // ==================== User's Tracks ====================

  getUserTracks(userId?: number, limit: number = 50): Observable<Track[]> {
    const endpoint = userId 
      ? `${this.apiBaseUrl}/users/${userId}/tracks`
      : `${this.apiBaseUrl}/me/tracks`;

    return this.http.get<TrackCollection>(endpoint, {
      headers: this.authService.getAuthHeaders(),
      params: {
        limit: limit.toString(),
        linked_partitioning: 'true'
      }
    }).pipe(
      map(response => response.collection),
      tap(tracks => {
        if (!userId) {
          this.userTracks$.next(tracks);
        }
      }),
      catchError(error => {
        console.error('Failed to fetch user tracks:', error);
        return throwError(() => error);
      })
    );
  }

  getUserTracks$(): Observable<Track[]> {
    return this.userTracks$.asObservable();
  }

  // ==================== Liked Tracks ====================

  getLikedTracks(limit: number = 50): Observable<Track[]> {
    return this.http.get<LikedTrackCollection>(`${this.apiBaseUrl}/me/likes/tracks`, {
      headers: this.authService.getAuthHeaders(),
      params: {
        limit: limit.toString(),
        linked_partitioning: 'true'
      }
    }).pipe(
      map(response => response.collection.map(item => item.track)),
      tap(tracks => {
        this.likedTracks$.next(tracks);
        console.log(`Loaded ${tracks.length} liked tracks`);
      }),
      catchError(error => {
        console.error('Failed to fetch liked tracks:', error);
        return throwError(() => error);
      })
    );
  }

  getLikedTracks$(): Observable<Track[]> {
    return this.likedTracks$.asObservable();
  }

  // ==================== Track Actions ====================

  likeTrack(trackId: number): Observable<any> {
    return this.http.post(`${this.apiBaseUrl}/likes/tracks/${trackId}`, null, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      tap(() => console.log(`Liked track ${trackId}`)),
      catchError(error => {
        console.error(`Failed to like track ${trackId}:`, error);
        return throwError(() => error);
      })
    );
  }

  unlikeTrack(trackId: number): Observable<any> {
    return this.http.delete(`${this.apiBaseUrl}/likes/tracks/${trackId}`, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      tap(() => console.log(`Unliked track ${trackId}`)),
      catchError(error => {
        console.error(`Failed to unlike track ${trackId}:`, error);
        return throwError(() => error);
      })
    );
  }

  // ==================== Track Lookup ====================

  getTrackById(trackId: number): Observable<Track> {
    return this.http.get<Track>(`${this.apiBaseUrl}/tracks/${trackId}`, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      catchError(error => {
        console.error(`Failed to fetch track ${trackId}:`, error);
        return throwError(() => error);
      })
    );
  }

  resolveTrackUrl(url: string): Observable<Track> {
    return this.http.get<Track>(`${this.apiBaseUrl}/resolve`, {
      headers: this.authService.getAuthHeaders(),
      params: { url }
    }).pipe(
      catchError(error => {
        console.error(`Failed to resolve track URL ${url}:`, error);
        return throwError(() => error);
      })
    );
  }

  // ==================== Search ====================

  searchTracks(query: string, limit: number = 20, options?: {
    genres?: string[];
    bpmFrom?: number;
    bpmTo?: number;
    durationFrom?: number;
    durationTo?: number;
    access?: 'playable' | 'preview' | 'blocked';
  }): Observable<Track[]> {
    let params: any = {
      q: query,
      limit: limit.toString(),
      linked_partitioning: 'true'
    };

    if (options?.genres?.length) {
      params.genres = options.genres.join(',');
    }
    if (options?.bpmFrom) {
      params['bpm[from]'] = options.bpmFrom.toString();
    }
    if (options?.bpmTo) {
      params['bpm[to]'] = options.bpmTo.toString();
    }
    if (options?.durationFrom) {
      params['duration[from]'] = options.durationFrom.toString();
    }
    if (options?.durationTo) {
      params['duration[to]'] = options.durationTo.toString();
    }
    if (options?.access) {
      params.access = options.access;
    }

    return this.http.get<TrackCollection>(`${this.apiBaseUrl}/tracks`, {
      headers: this.authService.getAuthHeaders(),
      params
    }).pipe(
      map(response => response.collection),
      catchError(error => {
        console.error('Track search failed:', error);
        return throwError(() => error);
      })
    );
  }

  // ==================== Streaming ====================

  getStreamUrl(trackId: number): Observable<string> {
    return this.http.get<any>(`${this.apiBaseUrl}/tracks/${trackId}/streams`, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      map(response => {
        // Return the HTTP progressive stream URL if available
        return response.http_mp3_128_url || response.hls_mp3_128_url || null;
      }),
      catchError(error => {
        console.error(`Failed to get stream URL for track ${trackId}:`, error);
        return throwError(() => error);
      })
    );
  }

  // ==================== Utility ====================

  formatDuration(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  getArtworkUrl(track: Track, size: 'large' | 'badge' | 't500x500' | 'crop' | 't300x300' | 't67x67' = 'large'): string {
    if (!track.artwork_url) {
      return track.user?.avatar_url || 'assets/img/default-artwork.png';
    }
    return track.artwork_url.replace('large', size);
  }

  clearCache(): void {
    this.likedTracks$.next([]);
    this.userTracks$.next([]);
  }
}
