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
    // Extract numeric ID - the id might be a number or string like "soundcloud:tracks:123"
    let numericId: number;
    const idStr = String(track.id);

    if (idStr.includes(':')) {
      // Format: "soundcloud:tracks:2215372484" -> extract last part
      const parts = idStr.split(':');
      numericId = parseInt(parts[parts.length - 1], 10);
    } else {
      numericId = parseInt(idStr, 10);
    }

    if (isNaN(numericId)) {
      console.error('Invalid track ID:', track.id);
      return null;
    }

    console.log('Fetching stream for track:', track.title, 'ID:', numericId);

    try {
      // Use /streams endpoint - returns pre-signed CloudFront URLs
      const streamsUrl = `${environment.apiBaseUrl}/tracks/${numericId}/streams`;
      const response = await this.http
        .get<any>(streamsUrl, {
          headers: this.authService.getAuthHeaders(),
        })
        .toPromise();

      // Prefer http_mp3_128_url (direct MP3), fallback to hls
      const url = response?.http_mp3_128_url || response?.hls_mp3_128_url;
      if (url) {
        console.log('Got stream URL for:', track.title);
        return url;
      }
    } catch (e: any) {
      console.warn('Failed to get streams URL:', e.status, e.message);
    }

    console.error('No stream URL found for track:', track.title);
    return null;
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
