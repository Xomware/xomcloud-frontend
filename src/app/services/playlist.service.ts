// playlist.service.ts - SoundCloud Playlist API Service
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError, map, switchMap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import {
  Playlist,
  PlaylistCollection,
  CreatePlaylistRequest,
  UpdatePlaylistRequest,
} from '../models';
import { AuthService } from './auth.service';
import { getPlaylistArtworkUrl } from '../utils/shared.utils';

interface LikedPlaylistItem {
  playlist: Playlist;
}

interface LikedPlaylistResponse {
  collection: LikedPlaylistItem[];
  next_href?: string;
}

@Injectable({
  providedIn: 'root',
})
export class PlaylistService {
  private readonly apiBaseUrl = environment.apiBaseUrl;

  private userPlaylists$ = new BehaviorSubject<Playlist[]>([]);
  private likedPlaylists$ = new BehaviorSubject<Playlist[]>([]);

  constructor(private http: HttpClient, private authService: AuthService) {}

  // ==================== User's Playlists ====================

  getUserPlaylists(
    showTracks: boolean = false,
    limit: number = 50
  ): Observable<Playlist[]> {
    return this.http
      .get<PlaylistCollection>(`${this.apiBaseUrl}/me/playlists`, {
        headers: this.authService.getAuthHeaders(),
        params: {
          show_tracks: showTracks.toString(),
          limit: limit.toString(),
          linked_partitioning: 'true',
        },
      })
      .pipe(
        map((response) => response.collection),
        tap((playlists) => {
          this.userPlaylists$.next(playlists);
        }),
        catchError((error) => {
          return throwError(() => error);
        })
      );
  }

  getUserPlaylists$(): Observable<Playlist[]> {
    return this.userPlaylists$.asObservable();
  }

  // ==================== Liked Playlists ====================

  getLikedPlaylists(limit: number = 50): Observable<Playlist[]> {
    return this.http
      .get<LikedPlaylistResponse>(
        `${this.apiBaseUrl}/me/likes/playlists`,
        {
          headers: this.authService.getAuthHeaders(),
          params: {
            limit: limit.toString(),
            linked_partitioning: 'true',
          },
        }
      )
      .pipe(
        map((response) => {
          return response.collection
            .filter((item) => item && item.playlist)
            .map((item) => item.playlist);
        }),
        tap((playlists) => {
          this.likedPlaylists$.next(playlists);
        }),
        catchError((error) => {
          return throwError(() => error);
        })
      );
  }

  getLikedPlaylists$(): Observable<Playlist[]> {
    return this.likedPlaylists$.asObservable();
  }

  // ==================== Playlist CRUD ====================

  getPlaylistById(
    playlistId: number,
    showTracks: boolean = true
  ): Observable<Playlist> {
    return this.http
      .get<Playlist>(`${this.apiBaseUrl}/playlists/${playlistId}`, {
        headers: this.authService.getAuthHeaders(),
        params: {
          show_tracks: showTracks.toString(),
        },
      })
      .pipe(
        catchError((error) => {
          return throwError(() => error);
        })
      );
  }

  createPlaylist(
    title: string,
    description?: string,
    sharing: 'public' | 'private' = 'public',
    trackIds?: number[]
  ): Observable<Playlist> {
    const request: CreatePlaylistRequest = {
      playlist: {
        title,
        description,
        sharing,
        tracks: trackIds?.map((id) => ({ id })),
      },
    };

    return this.http
      .post<Playlist>(`${this.apiBaseUrl}/playlists`, request, {
        headers: this.authService
          .getAuthHeaders()
          .set('Content-Type', 'application/json'),
      })
      .pipe(
        tap((playlist) => {
          const current = this.userPlaylists$.value;
          this.userPlaylists$.next([playlist, ...current]);
        }),
        catchError((error) => {
          return throwError(() => error);
        })
      );
  }

  updatePlaylist(
    playlistId: number,
    updates: UpdatePlaylistRequest['playlist']
  ): Observable<Playlist> {
    const request: UpdatePlaylistRequest = { playlist: updates };

    return this.http
      .put<Playlist>(`${this.apiBaseUrl}/playlists/${playlistId}`, request, {
        headers: this.authService
          .getAuthHeaders()
          .set('Content-Type', 'application/json'),
      })
      .pipe(
        tap((playlist) => {
          const current = this.userPlaylists$.value;
          const index = current.findIndex((p) => p.id === playlistId);
          if (index !== -1) {
            current[index] = playlist;
            this.userPlaylists$.next([...current]);
          }
        }),
        catchError((error) => {
          return throwError(() => error);
        })
      );
  }

  deletePlaylist(playlistId: number): Observable<void> {
    return this.http
      .delete<void>(`${this.apiBaseUrl}/playlists/${playlistId}`, {
        headers: this.authService.getAuthHeaders(),
      })
      .pipe(
        tap(() => {
          const current = this.userPlaylists$.value;
          this.userPlaylists$.next(current.filter((p) => p.id !== playlistId));
        }),
        catchError((error) => {
          return throwError(() => error);
        })
      );
  }

  // ==================== Playlist Tracks ====================

  addTracksToPlaylist(
    playlistId: number,
    trackIds: number[]
  ): Observable<Playlist> {
    return this.getPlaylistById(playlistId, true).pipe(
      switchMap((playlist) => {
        const existingIds = playlist.tracks.map((t) => t.id);
        const allIds = [...existingIds, ...trackIds];
        const request = { playlist: { tracks: allIds.map((id) => ({ id })) } };

        return this.http.put<Playlist>(
          `${this.apiBaseUrl}/playlists/${playlistId}`,
          request,
          {
            headers: this.authService
              .getAuthHeaders()
              .set('Content-Type', 'application/json'),
          }
        );
      }),
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  removeTrackFromPlaylist(
    playlistId: number,
    trackId: number
  ): Observable<Playlist> {
    return this.getPlaylistById(playlistId, true).pipe(
      switchMap((playlist) => {
        const remainingIds = playlist.tracks
          .filter((t) => t.id !== trackId)
          .map((t) => ({ id: t.id }));
        const request = { playlist: { tracks: remainingIds } };

        return this.http.put<Playlist>(
          `${this.apiBaseUrl}/playlists/${playlistId}`,
          request,
          {
            headers: this.authService
              .getAuthHeaders()
              .set('Content-Type', 'application/json'),
          }
        );
      }),
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  // ==================== Playlist Actions ====================

  likePlaylist(playlistId: number): Observable<void> {
    return this.http
      .post<void>(`${this.apiBaseUrl}/likes/playlists/${playlistId}`, null, {
        headers: this.authService.getAuthHeaders(),
      })
      .pipe(
        catchError((error) => {
          return throwError(() => error);
        })
      );
  }

  unlikePlaylist(playlistId: number): Observable<void> {
    return this.http
      .delete<void>(`${this.apiBaseUrl}/likes/playlists/${playlistId}`, {
        headers: this.authService.getAuthHeaders(),
      })
      .pipe(
        catchError((error) => {
          return throwError(() => error);
        })
      );
  }

  // ==================== Utility ====================

  getArtworkUrl(
    playlist: Playlist,
    size:
      | 'large'
      | 'badge'
      | 't500x500'
      | 'crop'
      | 't300x300'
      | 't67x67' = 'large'
  ): string {
    return getPlaylistArtworkUrl(playlist, size);
  }

  getTotalDuration(playlist: Playlist): string {
    const totalMs =
      playlist.tracks?.reduce((sum, track) => sum + track.duration, 0) ||
      playlist.duration;
    const totalMinutes = Math.floor(totalMs / 60000);
    if (totalMinutes >= 60) {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours}h ${minutes}m`;
    }
    return `${totalMinutes}m`;
  }

  clearCache(): void {
    this.userPlaylists$.next([]);
    this.likedPlaylists$.next([]);
  }
}
