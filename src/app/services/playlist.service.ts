// playlist.service.ts - SoundCloud Playlist API Service
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError, map, switchMap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { Playlist, PlaylistCollection, CreatePlaylistRequest, UpdatePlaylistRequest } from '../models';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class PlaylistService {
  private readonly apiBaseUrl = environment.apiBaseUrl;
  
  // Cache for user playlists
  private userPlaylists$ = new BehaviorSubject<Playlist[]>([]);
  private likedPlaylists$ = new BehaviorSubject<Playlist[]>([]);

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  // ==================== User's Playlists ====================

  getUserPlaylists(showTracks: boolean = false, limit: number = 50): Observable<Playlist[]> {
    return this.http.get<PlaylistCollection>(`${this.apiBaseUrl}/me/playlists`, {
      headers: this.authService.getAuthHeaders(),
      params: {
        show_tracks: showTracks.toString(),
        limit: limit.toString(),
        linked_partitioning: 'true'
      }
    }).pipe(
      map(response => response.collection),
      tap(playlists => {
        this.userPlaylists$.next(playlists);
        console.log(`Loaded ${playlists.length} user playlists`);
      }),
      catchError(error => {
        console.error('Failed to fetch user playlists:', error);
        return throwError(() => error);
      })
    );
  }

  getUserPlaylists$(): Observable<Playlist[]> {
    return this.userPlaylists$.asObservable();
  }

  // ==================== Liked Playlists ====================

  getLikedPlaylists(limit: number = 50): Observable<Playlist[]> {
    return this.http.get<{ collection: { playlist: Playlist }[] }>(`${this.apiBaseUrl}/me/likes/playlists`, {
      headers: this.authService.getAuthHeaders(),
      params: {
        limit: limit.toString(),
        linked_partitioning: 'true'
      }
    }).pipe(
      map(response => response.collection.map(item => item.playlist)),
      tap(playlists => {
        this.likedPlaylists$.next(playlists);
      }),
      catchError(error => {
        console.error('Failed to fetch liked playlists:', error);
        return throwError(() => error);
      })
    );
  }

  getLikedPlaylists$(): Observable<Playlist[]> {
    return this.likedPlaylists$.asObservable();
  }

  // ==================== Playlist CRUD ====================

  getPlaylistById(playlistId: number, showTracks: boolean = true): Observable<Playlist> {
    return this.http.get<Playlist>(`${this.apiBaseUrl}/playlists/${playlistId}`, {
      headers: this.authService.getAuthHeaders(),
      params: {
        show_tracks: showTracks.toString()
      }
    }).pipe(
      catchError(error => {
        console.error(`Failed to fetch playlist ${playlistId}:`, error);
        return throwError(() => error);
      })
    );
  }

  createPlaylist(title: string, description?: string, sharing: 'public' | 'private' = 'public', trackIds?: number[]): Observable<Playlist> {
    const request: CreatePlaylistRequest = {
      playlist: {
        title,
        description,
        sharing,
        tracks: trackIds?.map(id => ({ id }))
      }
    };

    return this.http.post<Playlist>(`${this.apiBaseUrl}/playlists`, request, {
      headers: this.authService.getAuthHeaders().set('Content-Type', 'application/json')
    }).pipe(
      tap(playlist => {
        console.log(`Created playlist: ${playlist.title}`);
        // Update cache
        const current = this.userPlaylists$.value;
        this.userPlaylists$.next([playlist, ...current]);
      }),
      catchError(error => {
        console.error('Failed to create playlist:', error);
        return throwError(() => error);
      })
    );
  }

  updatePlaylist(playlistId: number, updates: UpdatePlaylistRequest['playlist']): Observable<Playlist> {
    const request: UpdatePlaylistRequest = { playlist: updates };

    return this.http.put<Playlist>(`${this.apiBaseUrl}/playlists/${playlistId}`, request, {
      headers: this.authService.getAuthHeaders().set('Content-Type', 'application/json')
    }).pipe(
      tap(playlist => {
        console.log(`Updated playlist: ${playlist.title}`);
        // Update cache
        const current = this.userPlaylists$.value;
        const index = current.findIndex(p => p.id === playlistId);
        if (index !== -1) {
          current[index] = playlist;
          this.userPlaylists$.next([...current]);
        }
      }),
      catchError(error => {
        console.error(`Failed to update playlist ${playlistId}:`, error);
        return throwError(() => error);
      })
    );
  }

  deletePlaylist(playlistId: number): Observable<any> {
    return this.http.delete(`${this.apiBaseUrl}/playlists/${playlistId}`, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      tap(() => {
        console.log(`Deleted playlist ${playlistId}`);
        // Update cache
        const current = this.userPlaylists$.value;
        this.userPlaylists$.next(current.filter(p => p.id !== playlistId));
      }),
      catchError(error => {
        console.error(`Failed to delete playlist ${playlistId}:`, error);
        return throwError(() => error);
      })
    );
  }

  // ==================== Playlist Tracks ====================

  addTracksToPlaylist(playlistId: number, trackIds: number[]): Observable<Playlist> {
    return this.getPlaylistById(playlistId, true).pipe(
      switchMap(playlist => {
        const existingIds = playlist.tracks.map(t => t.id);
        const allIds = [...existingIds, ...trackIds];
        const request = { playlist: { tracks: allIds.map(id => ({ id })) } };
        
        return this.http.put<Playlist>(`${this.apiBaseUrl}/playlists/${playlistId}`, request, {
          headers: this.authService.getAuthHeaders().set('Content-Type', 'application/json')
        });
      }),
      catchError(error => {
        console.error(`Failed to add tracks to playlist ${playlistId}:`, error);
        return throwError(() => error);
      })
    );
  }

  removeTrackFromPlaylist(playlistId: number, trackId: number): Observable<Playlist> {
    return this.getPlaylistById(playlistId, true).pipe(
      switchMap(playlist => {
        const remainingIds = playlist.tracks
          .filter(t => t.id !== trackId)
          .map(t => ({ id: t.id }));
        const request = { playlist: { tracks: remainingIds } };
        
        return this.http.put<Playlist>(`${this.apiBaseUrl}/playlists/${playlistId}`, request, {
          headers: this.authService.getAuthHeaders().set('Content-Type', 'application/json')
        });
      }),
      catchError(error => {
        console.error(`Failed to remove track from playlist ${playlistId}:`, error);
        return throwError(() => error);
      })
    );
  }

  // ==================== Playlist Actions ====================

  likePlaylist(playlistId: number): Observable<any> {
    return this.http.post(`${this.apiBaseUrl}/likes/playlists/${playlistId}`, null, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      tap(() => console.log(`Liked playlist ${playlistId}`)),
      catchError(error => {
        console.error(`Failed to like playlist ${playlistId}:`, error);
        return throwError(() => error);
      })
    );
  }

  unlikePlaylist(playlistId: number): Observable<any> {
    return this.http.delete(`${this.apiBaseUrl}/likes/playlists/${playlistId}`, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      tap(() => console.log(`Unliked playlist ${playlistId}`)),
      catchError(error => {
        console.error(`Failed to unlike playlist ${playlistId}:`, error);
        return throwError(() => error);
      })
    );
  }

  // ==================== Utility ====================

  getArtworkUrl(playlist: Playlist, size: 'large' | 'badge' | 't500x500' | 'crop' | 't300x300' | 't67x67' = 'large'): string {
    if (!playlist.artwork_url) {
      // Try to get artwork from first track
      if (playlist.tracks?.length > 0 && playlist.tracks[0].artwork_url) {
        return playlist.tracks[0].artwork_url.replace('large', size);
      }
      return playlist.user?.avatar_url || 'assets/img/default-artwork.png';
    }
    return playlist.artwork_url.replace('large', size);
  }

  getTotalDuration(playlist: Playlist): string {
    const totalMs = playlist.tracks?.reduce((sum, track) => sum + track.duration, 0) || playlist.duration;
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
