// download.service.ts - Handles track downloads via Lambda API
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Track } from '../models';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { DownloadQueueService } from './download-queue.service';
import { environment } from 'src/environments/environment.prod';

export interface DownloadProgress {
  phase:
    | 'idle'
    | 'uploading'
    | 'processing'
    | 'downloading'
    | 'complete'
    | 'error';
  message: string;
  percentage: number;
}

export interface DownloadRequest {
  tracks: {
    id: string;
    url: string;
    title: string;
    artist: string;
  }[];
}

export interface DownloadResponse {
  data: {
    download_url: string;
    expires_in: number;
    total: number;
    successful: number;
    failed: { id: string; title: string; error: string }[];
  };
}

export interface DownloadErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class DownloadService {
  private readonly xomcloudApi = `https://${environment.apiId}.execute-api.us-east-1.amazonaws.com/dev`;
  private readonly soundcloudApi = environment.apiBaseUrl;
  private readonly xomcloudApiToken = environment.apiAuthToken;

  private progress$ = new BehaviorSubject<DownloadProgress>({
    phase: 'idle',
    message: '',
    percentage: 0,
  });

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private toastService: ToastService,
    private queueService: DownloadQueueService
  ) {}

  // ==================== Progress Observable ====================

  getProgress$(): Observable<DownloadProgress> {
    return this.progress$.asObservable();
  }

  private setProgress(
    phase: DownloadProgress['phase'],
    message: string,
    percentage: number
  ): void {
    this.progress$.next({ phase, message, percentage });
  }

  private resetProgress(): void {
    this.progress$.next({ phase: 'idle', message: '', percentage: 0 });
  }

  // ==================== Download via Lambda API ====================

  async downloadQueue(): Promise<boolean> {
    const queue = this.queueService.getQueue();

    if (queue.length === 0) {
      this.toastService.showNegativeToast('Your crate is empty');
      return false;
    }

    if (queue.length > 50) {
      this.toastService.showNegativeToast('Maximum 50 tracks per download');
      return false;
    }

    this.queueService.setProcessing(true);

    try {
      // Phase 1: Prepare request
      this.setProgress('uploading', 'Preparing tracks...', 10);

      const request: DownloadRequest = {
        tracks: queue.map((item) => ({
          id: String(item.track.id),
          url: item.track.permalink_url,
          title: item.track.title,
          artist: item.track.user?.username || 'Unknown Artist',
        })),
      };

      // Phase 2: Send to Lambda
      this.setProgress(
        'processing',
        `Processing ${queue.length} tracks...`,
        30
      );

      const response = await this.callDownloadApi(request);

      if (!response) {
        throw new Error('No response from server');
      }

      // Phase 3: Download the zip
      this.setProgress('downloading', 'Downloading zip file...', 70);

      await this.downloadFromUrl(response.data.download_url);

      // Phase 4: Complete
      this.setProgress('complete', 'Download complete!', 100);

      // Show results
      const { successful, total, failed } = response.data;
      if (failed.length > 0) {
        this.toastService.showInfoToast(
          `Downloaded ${successful}/${total} tracks. ${failed.length} failed.`
        );
        console.warn('Failed tracks:', failed);
      } else {
        this.toastService.showPositiveToast(`Downloaded ${successful} tracks!`);
      }

      // Reset after delay
      setTimeout(() => this.resetProgress(), 3000);
      return true;
    } catch (error) {
      console.error('Download failed:', error);
      const message =
        error instanceof Error ? error.message : 'Download failed';
      this.setProgress('error', message, 0);
      this.toastService.showNegativeToast(message);

      setTimeout(() => this.resetProgress(), 5000);
      return false;
    } finally {
      this.queueService.setProcessing(false);
    }
  }

  private async callDownloadApi(
    request: DownloadRequest
  ): Promise<DownloadResponse> {
    return new Promise((resolve, reject) => {
      this.http
        .post<DownloadResponse | DownloadErrorResponse>(
          `${this.xomcloudApi}/download`,
          request,
          { headers: this.getApiHeaders() }
        )
        .subscribe({
          next: (response) => {
            if ('error' in response) {
              reject(new Error(response.error.message));
            } else {
              resolve(response);
            }
          },
          error: (err: HttpErrorResponse) => {
            const message =
              err.error?.error?.message || err.message || 'API request failed';
            reject(new Error(message));
          },
        });
    });
  }

  private getApiHeaders(): { [key: string]: string } {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.xomcloudApiToken}`,
    };
  }

  private async downloadFromUrl(url: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to download zip file');
    }

    const blob = await response.blob();
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `xomcloud-${timestamp}.zip`;

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  }

  // ==================== Single Track Download ====================

  downloadSingleTrack(track: Track): void {
    this.toastService.showInfoToast(`Preparing "${track.title}"...`);

    const request: DownloadRequest = {
      tracks: [
        {
          id: String(track.id),
          url: track.permalink_url,
          title: track.title,
          artist: track.user?.username || 'Unknown Artist',
        },
      ],
    };

    this.http
      .post<DownloadResponse | DownloadErrorResponse>(
        `${this.xomcloudApi}/download`,
        request,
        { headers: this.getApiHeaders() }
      )
      .subscribe({
        next: async (response) => {
          if ('error' in response) {
            this.toastService.showNegativeToast(response.error.message);
            return;
          }

          try {
            window.open(response.data.download_url, '_blank');
            this.toastService.showPositiveToast('Download started!');
          } catch (err) {
            this.toastService.showNegativeToast('Failed to start download');
          }
        },
        error: (err) => {
          console.error('Single track download failed:', err);
          this.toastService.showNegativeToast('Download failed');
        },
      });
  }

  // ==================== Stream URL (for playback) ====================

  getStreamUrl(track: Track): Observable<string | null> {
    if (track.media?.transcodings) {
      const progressive = track.media.transcodings.find(
        (t) =>
          t.format.protocol === 'progressive' &&
          t.format.mime_type === 'audio/mpeg'
      );

      if (progressive) {
        return this.http
          .get<{ url: string }>(progressive.url, {
            headers: this.authService.getAuthHeaders(),
          })
          .pipe(
            map((response) => response.url),
            catchError(() => this.fallbackStreamUrl(track.id))
          );
      }
    }
    return this.fallbackStreamUrl(track.id);
  }

  private fallbackStreamUrl(trackId: number): Observable<string | null> {
    return this.http
      .get<any>(`${this.soundcloudApi}/tracks/${trackId}/streams`, {
        headers: this.authService.getAuthHeaders(),
      })
      .pipe(
        map(
          (response) =>
            response.http_mp3_128_url || response.hls_mp3_128_url || null
        ),
        catchError(() => of(null))
      );
  }
}
