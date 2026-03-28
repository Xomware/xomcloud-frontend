// track.service.ts - SoundCloud Track API Service
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { Track, TrackCollection, LikedTrack } from '../models';
import { AuthService } from './auth.service';
import { getTrackArtworkUrl } from '../utils/shared.utils';

export interface PaginatedTracks {
  tracks: Track[];
  nextUrl: string | null;
  hasMore: boolean;
}

interface LikedTrackResponse {
  collection: Array<LikedTrack | Track>;
  next_href?: string;
}

interface StreamsResponse {
  http_mp3_128_url?: string;
  hls_mp3_128_url?: string;
}

@Injectable({
  providedIn: 'root',
})
export class TrackService {
  private readonly apiBaseUrl = environment.apiBaseUrl;

  private likedTracks$ = new BehaviorSubject<Track[]>([]);
  private userTracks$ = new BehaviorSubject<Track[]>([]);

  constructor(private http: HttpClient, private authService: AuthService) {}

  // ==================== User's Tracks ====================

  getUserTracks(userId?: number, limit: number = 50): Observable<Track[]> {
    const endpoint = userId
      ? `${this.apiBaseUrl}/users/${userId}/tracks`
      : `${this.apiBaseUrl}/me/tracks`;

    return this.http
      .get<TrackCollection>(endpoint, {
        headers: this.authService.getAuthHeaders(),
        params: {
          limit: limit.toString(),
          linked_partitioning: 'true',
        },
      })
      .pipe(
        map((response) => response.collection),
        tap((tracks) => {
          if (!userId) {
            this.userTracks$.next(tracks);
          }
        }),
        catchError((error) => this.handleError(error, 'fetch user tracks'))
      );
  }

  getUserTracks$(): Observable<Track[]> {
    return this.userTracks$.asObservable();
  }

  // ==================== Liked Tracks (Paginated) ====================

  getLikedTracks(limit: number = 50): Observable<Track[]> {
    return this.getLikedTracksPaginated(limit).pipe(
      map((result) => result.tracks)
    );
  }

  getLikedTracksPaginated(
    limit: number = 50,
    nextUrl?: string
  ): Observable<PaginatedTracks> {
    const url = nextUrl || `${this.apiBaseUrl}/me/likes/tracks`;

    const request = nextUrl
      ? this.http.get<LikedTrackResponse>(url, { headers: this.authService.getAuthHeaders() })
      : this.http.get<LikedTrackResponse>(url, {
          headers: this.authService.getAuthHeaders(),
          params: {
            limit: limit.toString(),
            linked_partitioning: 'true',
          },
        });

    return request.pipe(
      map((response) => {
        const tracks = this.extractTracks(response);
        return {
          tracks,
          nextUrl: response.next_href || null,
          hasMore: !!response.next_href,
        };
      }),
      tap((result) => {
        if (!nextUrl) {
          this.likedTracks$.next(result.tracks);
        }
      }),
      catchError((error) => this.handleError(error, 'fetch liked tracks'))
    );
  }

  // ==================== Other User's Liked Tracks ====================

  getUserLikedTracks(userId: number, limit: number = 50): Observable<Track[]> {
    return this.getUserLikedTracksPaginated(userId, limit).pipe(
      map((result) => result.tracks)
    );
  }

  getUserLikedTracksPaginated(
    userId: number,
    limit: number = 50,
    nextUrl?: string
  ): Observable<PaginatedTracks> {
    const url = nextUrl || `${this.apiBaseUrl}/users/${userId}/likes/tracks`;

    const request = nextUrl
      ? this.http.get<LikedTrackResponse>(url, { headers: this.authService.getAuthHeaders() })
      : this.http.get<LikedTrackResponse>(url, {
          headers: this.authService.getAuthHeaders(),
          params: {
            limit: limit.toString(),
            linked_partitioning: 'true',
          },
        });

    return request.pipe(
      map((response) => {
        const tracks = this.extractTracks(response);
        return {
          tracks,
          nextUrl: response.next_href || null,
          hasMore: !!response.next_href,
        };
      }),
      catchError((error) => {
        if (error.status === 403) {
          return of({ tracks: [], nextUrl: null, hasMore: false });
        }
        return this.handleError(error, 'fetch user liked tracks');
      })
    );
  }

  // ==================== Extract tracks from response ====================

  private extractTracks(response: LikedTrackResponse): Track[] {
    if (!response.collection || !Array.isArray(response.collection)) {
      return [];
    }

    return response.collection
      .filter((item): item is LikedTrack | Track => item != null)
      .map((item) => {
        // Handle both response formats:
        // Format A: { collection: [{ track: {...} }] } - wrapped in track object
        // Format B: { collection: [{...}] } - direct track objects
        if ('track' in item && item.track) {
          return item.track;
        }
        return item as Track;
      })
      .filter((track): track is Track => track != null && track.id != null);
  }

  getLikedTracks$(): Observable<Track[]> {
    return this.likedTracks$.asObservable();
  }

  // ==================== Track Actions ====================

  likeTrack(trackId: number): Observable<void> {
    return this.http
      .post<void>(`${this.apiBaseUrl}/likes/tracks/${trackId}`, null, {
        headers: this.authService.getAuthHeaders(),
      })
      .pipe(
        catchError((error) => this.handleError(error, 'like track'))
      );
  }

  unlikeTrack(trackId: number): Observable<void> {
    return this.http
      .delete<void>(`${this.apiBaseUrl}/likes/tracks/${trackId}`, {
        headers: this.authService.getAuthHeaders(),
      })
      .pipe(
        catchError((error) => this.handleError(error, 'unlike track'))
      );
  }

  // ==================== Track Lookup ====================

  getTrackById(trackId: number): Observable<Track> {
    return this.http
      .get<Track>(`${this.apiBaseUrl}/tracks/${trackId}`, {
        headers: this.authService.getAuthHeaders(),
      })
      .pipe(catchError((error) => this.handleError(error, 'fetch track')));
  }

  resolveTrackUrl(url: string): Observable<Track> {
    return this.http
      .get<Track>(`${this.apiBaseUrl}/resolve`, {
        headers: this.authService.getAuthHeaders(),
        params: { url },
      })
      .pipe(
        catchError((error) => this.handleError(error, 'resolve track URL'))
      );
  }

  // ==================== Search ====================

  searchTracks(
    query: string,
    limit: number = 20,
    options?: {
      genres?: string[];
      bpmFrom?: number;
      bpmTo?: number;
      durationFrom?: number;
      durationTo?: number;
      access?: 'playable' | 'preview' | 'blocked';
    }
  ): Observable<Track[]> {
    const params: Record<string, string> = {
      q: query,
      limit: limit.toString(),
      linked_partitioning: 'true',
    };

    if (options?.genres?.length) {
      params['genres'] = options.genres.join(',');
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
      params['access'] = options.access;
    }

    return this.http
      .get<TrackCollection>(`${this.apiBaseUrl}/tracks`, {
        headers: this.authService.getAuthHeaders(),
        params,
      })
      .pipe(
        map((response) => response.collection),
        catchError((error) => this.handleError(error, 'search tracks'))
      );
  }

  // ==================== Streaming ====================

  getStreamUrl(trackId: number): Observable<string> {
    return this.http
      .get<StreamsResponse>(`${this.apiBaseUrl}/tracks/${trackId}/streams`, {
        headers: this.authService.getAuthHeaders(),
      })
      .pipe(
        map((response) => {
          return response.http_mp3_128_url || response.hls_mp3_128_url || '';
        }),
        catchError((error) => this.handleError(error, 'get stream URL'))
      );
  }

  // ==================== Utility ====================

  formatDuration(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  getArtworkUrl(
    track: Track,
    size:
      | 'large'
      | 'badge'
      | 't500x500'
      | 'crop'
      | 't300x300'
      | 't67x67' = 'large'
  ): string {
    return getTrackArtworkUrl(track, size);
  }

  clearCache(): void {
    this.likedTracks$.next([]);
    this.userTracks$.next([]);
  }

  // ==================== Error Handling ====================

  private handleError(
    error: HttpErrorResponse,
    _operation: string
  ): Observable<never> {
    return throwError(() => error);
  }
}
