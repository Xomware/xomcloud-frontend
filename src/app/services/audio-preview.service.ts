// audio-preview.service.ts - Plays track previews using SoundCloud streaming API
import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
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

interface StreamsResponse {
  http_mp3_128_url?: string;
  hls_mp3_128_url?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AudioPreviewService implements OnDestroy {
  private audio: HTMLAudioElement | null = null;
  private state$ = new BehaviorSubject<PreviewState>({
    isPlaying: false,
    trackId: null,
    progress: 0,
    duration: 0,
    currentTime: 0,
  });
  private progressInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private http: HttpClient, private authService: AuthService) {}

  ngOnDestroy(): void {
    this.destroy();
  }

  destroy(): void {
    this.stop();
  }

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

    try {
      const streamUrl = await this.fetchStreamUrl(numericId);

      if (!streamUrl) {
        return;
      }

      this.audio = new Audio(streamUrl);
      this.audio.volume = 0.7;

      this.audio.onloadedmetadata = () => {
        this.updateState({ duration: this.audio?.duration || 0 });
      };

      this.audio.onended = () => this.stop();
      this.audio.onerror = () => {
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
    } catch {
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

  private async fetchStreamUrl(trackId: number): Promise<string | null> {
    const streamsUrl = `${environment.apiBaseUrl}/tracks/${trackId}/streams`;

    try {
      const streams = await firstValueFrom(
        this.http.get<StreamsResponse>(streamsUrl, {
          headers: this.authService.getAuthHeaders(),
        })
      );

      const mp3Url = streams?.http_mp3_128_url;

      if (!mp3Url) {
        return null;
      }

      const token = this.authService.getAccessToken();
      const response = await fetch(mp3Url, {
        method: 'GET',
        headers: {
          Authorization: `OAuth ${token}`,
        },
        redirect: 'follow',
      });

      if (response.ok && response.url) {
        return response.url;
      }

      return null;
    } catch {
      return null;
    }
  }

  // ==================== Helpers ====================

  private extractNumericId(id: number | string): number {
    if (typeof id === 'number') {
      return id;
    }

    const str = String(id);

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
