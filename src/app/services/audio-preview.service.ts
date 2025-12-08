// audio-preview.service.ts - Plays track previews using SoundCloud streaming API
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { Track } from '../models';
import { AuthService } from './auth.service';
import { environment } from 'src/environments/environment';

export interface PreviewState {
  isPlaying: boolean;
  trackId: number | null;
  progress: number;
  duration: number;
  currentTime: number;
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

  isPlaying(trackId?: number): boolean {
    const state = this.state$.value;
    if (trackId !== undefined) {
      const numericId = this.extractNumericId(trackId);
      return state.isPlaying && state.trackId === numericId;
    }
    return state.isPlaying;
  }

  async toggle(track: Track): Promise<void> {
    const numericId = this.extractNumericId(track.id);

    if (this.state$.value.trackId === numericId) {
      if (this.state$.value.isPlaying) {
        this.pause();
      } else {
        this.resume();
      }
    } else {
      await this.play(track);
    }
  }

  private async play(track: Track): Promise<void> {
    this.stop();

    const numericId = this.extractNumericId(track.id);
    console.log('Playing track:', track.title, 'ID:', numericId);

    try {
      // Step 1: Get the direct stream URL from SoundCloud
      const streamUrl = await this.fetchStreamUrl(numericId);

      if (!streamUrl) {
        console.error('Could not get stream URL for:', track.title);
        return;
      }

      console.log('Got stream URL:', streamUrl.substring(0, 80) + '...');

      // Step 2: Create audio element and play
      this.audio = new Audio(streamUrl);
      this.audio.volume = 0.7;

      this.audio.onloadedmetadata = () => {
        this.updateState({ duration: this.audio?.duration || 0 });
      };

      this.audio.onended = () => this.stop();
      this.audio.onerror = (e) => {
        console.error('Audio error:', e);
        this.stop();
      };

      await this.audio.play();

      this.updateState({
        isPlaying: true,
        trackId: numericId,
        progress: 0,
        currentTime: 0,
      });

      this.startProgressTracking();
    } catch (error) {
      console.error('Failed to play:', error);
      this.stop();
    }
  }

  private pause(): void {
    if (this.audio) {
      this.audio.pause();
      this.stopProgressTracking();
      this.updateState({ isPlaying: false });
    }
  }

  private resume(): void {
    if (this.audio) {
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

  // ==================== API Calls ====================

  /**
   * Fetch the actual MP3 stream URL from SoundCloud API
   * Per docs: GET /tracks/:id/streams returns { http_mp3_128_url: "..." }
   */
  private async fetchStreamUrl(trackId: number): Promise<string | null> {
    const url = `${environment.apiBaseUrl}/tracks/${trackId}/streams`;

    try {
      const response = await this.http
        .get<any>(url, {
          headers: this.authService.getAuthHeaders(),
        })
        .toPromise();

      // The response contains pre-signed URLs for different formats
      return response?.http_mp3_128_url || response?.hls_mp3_128_url || null;
    } catch (error: any) {
      console.error(
        'Failed to fetch stream URL:',
        error.status,
        error.statusText
      );
      return null;
    }
  }

  // ==================== Helpers ====================

  /**
   * Extract numeric ID from track.id
   * Handles: 12345, "12345", "soundcloud:tracks:12345"
   */
  private extractNumericId(id: number | string): number {
    if (typeof id === 'number') {
      return id;
    }

    const str = String(id);

    // Handle "soundcloud:tracks:12345" format
    if (str.includes(':')) {
      const parts = str.split(':');
      return parseInt(parts[parts.length - 1], 10);
    }

    return parseInt(str, 10);
  }

  private startProgressTracking(): void {
    this.stopProgressTracking();
    this.progressInterval = setInterval(() => {
      if (this.audio) {
        const currentTime = this.audio.currentTime;
        const duration = this.audio.duration || 1;
        this.updateState({
          currentTime,
          duration,
          progress: (currentTime / duration) * 100,
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
    this.state$.next({ ...this.state$.value, ...partial });
  }
}
