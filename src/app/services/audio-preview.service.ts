// audio-preview.service.ts - Plays 30-second track previews
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { Track } from '../models';
import { AuthService } from './auth.service';
import { environment } from 'src/environments/environment';

export interface PreviewState {
  isPlaying: boolean;
  trackId: number | null;
  progress: number; // 0-100
  duration: number; // seconds
  currentTime: number; // seconds
}

@Injectable({
  providedIn: 'root',
})
export class AudioPreviewService {
  private audio: HTMLAudioElement | null = null;
  private state$ = new BehaviorSubject<PreviewState>({
    isPlaying: false,
    trackId: null,
    progress: 0,
    duration: 0,
    currentTime: 0,
  });

  private progressInterval: any = null;

  constructor(private http: HttpClient, private authService: AuthService) {}

  getState$(): Observable<PreviewState> {
    return this.state$.asObservable();
  }

  getState(): PreviewState {
    return this.state$.value;
  }

  isPlaying(trackId?: number): boolean {
    const state = this.state$.value;
    if (trackId !== undefined) {
      return state.isPlaying && state.trackId === trackId;
    }
    return state.isPlaying;
  }

  async play(track: Track): Promise<void> {
    // If same track is playing, pause it
    if (this.state$.value.trackId === track.id && this.state$.value.isPlaying) {
      this.pause();
      return;
    }

    // Stop any currently playing track
    this.stop();

    try {
      const streamUrl = await this.getStreamUrl(track);
      if (!streamUrl) {
        console.error('No stream URL available for track:', track.title);
        return;
      }

      this.audio = new Audio(streamUrl);
      this.audio.volume = 0.7;
      this.audio.crossOrigin = 'anonymous';

      // Set up event listeners
      this.audio.onloadedmetadata = () => {
        this.updateState({
          duration: this.audio?.duration || 30,
        });
      };

      this.audio.onended = () => {
        this.stop();
      };

      this.audio.onerror = (e) => {
        console.error('Audio playback error:', e);
        this.stop();
      };

      await this.audio.play();

      this.updateState({
        isPlaying: true,
        trackId: track.id,
        progress: 0,
        currentTime: 0,
      });

      // Start progress tracking
      this.startProgressTracking();
    } catch (error) {
      console.error('Failed to play track:', error);
      this.stop();
    }
  }

  pause(): void {
    if (this.audio) {
      this.audio.pause();
      this.stopProgressTracking();
      this.updateState({ isPlaying: false });
    }
  }

  resume(): void {
    if (this.audio && this.state$.value.trackId) {
      this.audio.play();
      this.startProgressTracking();
      this.updateState({ isPlaying: true });
    }
  }

  stop(): void {
    this.stopProgressTracking();

    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }

    this.state$.next({
      isPlaying: false,
      trackId: null,
      progress: 0,
      duration: 0,
      currentTime: 0,
    });
  }

  toggle(track: Track): void {
    if (this.state$.value.trackId === track.id) {
      if (this.state$.value.isPlaying) {
        this.pause();
      } else {
        this.resume();
      }
    } else {
      this.play(track);
    }
  }

  // ==================== Stream URL Resolution ====================

  private async getStreamUrl(track: Track): Promise<string | null> {
    // Extract numeric ID from track (may be prefixed with "soundcloud:tracks:")
    const numericId = String(track.id).replace('soundcloud:tracks:', '');

    // Priority 1: Try media transcodings (most reliable)
    if (track.media?.transcodings?.length) {
      // Prefer progressive (direct MP3) over HLS
      const progressive = track.media.transcodings.find(
        (t) => t.format.protocol === 'progressive' && !t.snipped
      );
      const progressiveSnipped = track.media.transcodings.find(
        (t) => t.format.protocol === 'progressive' && t.snipped
      );
      const hls = track.media.transcodings.find(
        (t) => t.format.protocol === 'hls'
      );

      // Try full track first, then snipped preview
      const transcoding = progressive || progressiveSnipped || hls;
      if (transcoding) {
        try {
          const resolved = await this.resolveTranscodingUrl(transcoding.url);
          if (resolved) {
            console.log('Using transcoding URL for:', track.title);
            return resolved;
          }
        } catch (e) {
          console.warn('Failed to resolve transcoding URL:', e);
        }
      }
    }

    // Priority 2: Try fetching track details to get media transcodings
    try {
      const trackDetails = await this.fetchTrackDetails(numericId);
      if (trackDetails?.media?.transcodings?.length) {
        const progressive = trackDetails.media.transcodings.find(
          (t: any) => t.format.protocol === 'progressive'
        );
        if (progressive) {
          const resolved = await this.resolveTranscodingUrl(progressive.url);
          if (resolved) {
            console.log('Using fetched transcoding URL for:', track.title);
            return resolved;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch track details:', e);
    }

    // Priority 3: Direct stream URL (often blocked by CORS or returns 401)
    console.log('Falling back to direct stream URL for:', track.title);
    const streamUrl = `${environment.apiBaseUrl}/tracks/${numericId}/stream`;
    return this.appendAuth(streamUrl);
  }

  private async fetchTrackDetails(trackId: string): Promise<any> {
    const url = `${environment.apiBaseUrl}/tracks/${trackId}`;
    const authUrl = this.appendAuth(url);
    return this.http.get(authUrl).toPromise();
  }

  private async resolveTranscodingUrl(url: string): Promise<string | null> {
    try {
      const authUrl = this.appendAuth(url);
      const response = await this.http
        .get<{ url: string }>(authUrl)
        .toPromise();
      return response?.url || null;
    } catch (error) {
      console.error('Failed to resolve transcoding URL:', error);
      return null;
    }
  }

  private appendAuth(url: string): string {
    const token = this.authService.getAccessToken();
    if (!token) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}oauth_token=${token}`;
  }

  // ==================== Progress Tracking ====================

  private startProgressTracking(): void {
    this.stopProgressTracking();

    this.progressInterval = setInterval(() => {
      if (this.audio) {
        const currentTime = this.audio.currentTime;
        const duration = this.audio.duration || 30;
        const progress = (currentTime / duration) * 100;

        this.updateState({
          currentTime,
          duration,
          progress: Math.min(progress, 100),
        });
      }
    }, 100);
  }

  private stopProgressTracking(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  private updateState(partial: Partial<PreviewState>): void {
    this.state$.next({
      ...this.state$.value,
      ...partial,
    });
  }
}
