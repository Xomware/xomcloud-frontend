// download.service.ts - Uses Lambda Function URL for downloads (no timeout limit)
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { Track } from '../models';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { DownloadQueueService } from './download-queue.service';
import { environment } from 'src/environments/environment';
import { UserService } from './user.service';

export interface DownloadProgress {
  phase:
    | 'idle'
    | 'preparing'
    | 'uploading'
    | 'processing'
    | 'complete'
    | 'error';
  message: string;
  currentTrack: string;
  current: number;
  total: number;
  percentage: number;
}

export interface DownloadResponse {
  data: {
    download_url: string;
    expires_in: number;
    total: number;
    successful: number;
    failed_count: number;
    failed?: Array<{
      id: string;
      title: string;
      artist: string;
      error: string;
    }>;
    tracks_downloaded?: Array<{
      id: string;
      title: string;
      artist: string;
    }>;
  };
}

@Injectable({
  providedIn: 'root',
})
export class DownloadService {
  private progress$ = new BehaviorSubject<DownloadProgress>({
    phase: 'idle',
    message: '',
    currentTrack: '',
    current: 0,
    total: 0,
    percentage: 0,
  });

  private progressInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private userService: UserService,
    private toastService: ToastService,
    private queueService: DownloadQueueService
  ) {}

  getProgress$(): Observable<DownloadProgress> {
    return this.progress$.asObservable();
  }

  private setProgress(
    phase: DownloadProgress['phase'],
    message: string,
    currentTrack: string = '',
    current: number = 0,
    total: number = 0
  ): void {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    this.progress$.next({
      phase,
      message,
      currentTrack,
      current,
      total,
      percentage,
    });
  }

  private resetProgress(): void {
    this.stopProgressSimulation();
    this.progress$.next({
      phase: 'idle',
      message: '',
      currentTrack: '',
      current: 0,
      total: 0,
      percentage: 0,
    });
  }

  isDownloading(): boolean {
    const phase = this.progress$.value.phase;
    return phase !== 'idle' && phase !== 'complete' && phase !== 'error';
  }

  // ==================== Progress Simulation ====================

  private startProgressSimulation(tracks: Track[]): void {
    this.stopProgressSimulation();

    const totalDurationMs = tracks.reduce(
      (sum, t) => sum + (t.duration || 180000),
      0
    );

    const estimatedProcessingMs = Math.max(
      2000,
      Math.min(totalDurationMs / 240, 40000)
    );

    const updateInterval = 200;
    const totalUpdates = estimatedProcessingMs / updateInterval;
    const incrementPerUpdate = 99 / totalUpdates;

    let currentProgress = 0;

    this.progress$.next({
      phase: 'processing',
      message: 'Downloading tracks...',
      currentTrack: '',
      current: 0,
      total: tracks.length,
      percentage: 0,
    });

    this.progressInterval = setInterval(() => {
      currentProgress = Math.min(currentProgress + incrementPerUpdate, 99);

      this.progress$.next({
        phase: 'processing',
        message:
          currentProgress >= 99 ? 'Almost done...' : 'Downloading tracks...',
        currentTrack: '',
        current: 0,
        total: tracks.length,
        percentage: Math.round(currentProgress),
      });
    }, updateInterval);
  }

  private stopProgressSimulation(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  // ==================== Main Download ====================

  async downloadSelected(tracks: Track[]): Promise<boolean> {
    if (tracks.length === 0) {
      this.toastService.showNegativeToast('No tracks selected');
      return false;
    }

    if (tracks.length > 5) {
      this.toastService.showNegativeToast('Maximum 5 tracks per download');
      return false;
    }

    const downloadUrl = environment.downloadApiUrl;
    if (!downloadUrl) {
      this.toastService.showNegativeToast('Download service not configured');
      return false;
    }

    this.queueService.setProcessing(true);

    try {
      this.setProgress(
        'preparing',
        'Preparing download...',
        '',
        0,
        tracks.length
      );

      const payload = tracks.map((track) => ({
        id: track.id,
        url: track.permalink_url,
        title: track.title,
        artist: track.user?.username || 'Unknown Artist',
      }));

      this.setProgress(
        'uploading',
        'Sending to server...',
        '',
        0,
        tracks.length
      );

      this.startProgressSimulation(tracks);

      const response = await firstValueFrom(
        this.http.post<DownloadResponse>(
          downloadUrl,
          { tracks: payload, username: this.userService.getUsername() },
          { headers: this.authService.getXomcloudHeaders() }
        )
      );

      this.stopProgressSimulation();

      if (!response?.data?.download_url) {
        throw new Error('No download URL received from server');
      }

      const { data } = response;

      this.setProgress(
        'complete',
        'Download ready!',
        '',
        data.successful,
        data.total
      );

      window.open(data.download_url, '_blank');

      if (data.failed_count > 0) {
        this.toastService.showInfoToast(
          `Downloaded ${data.successful}/${data.total} tracks. ${data.failed_count} failed.`
        );
      } else {
        this.toastService.showPositiveToast(
          `Downloaded ${data.successful} tracks!`
        );
      }

      setTimeout(() => this.resetProgress(), 4000);
      return true;
    } catch (error: unknown) {
      this.stopProgressSimulation();

      const errorMessage = this.getErrorMessage(error);
      this.setProgress('error', errorMessage, '', 0, 0);
      this.toastService.showNegativeToast(errorMessage);

      setTimeout(() => this.resetProgress(), 4000);
      return false;
    } finally {
      this.queueService.setProcessing(false);
    }
  }

  async downloadQueue(): Promise<boolean> {
    const queue = this.queueService.getQueue();
    const tracks = queue.slice(0, 5).map((q) => q.track);
    return this.downloadSelected(tracks);
  }

  // ==================== Single Track Download ====================

  async downloadSingleTrack(track: Track): Promise<void> {
    const downloadUrl = environment.downloadApiUrl;

    if (!downloadUrl) {
      if (track.permalink_url) {
        window.open(track.permalink_url, '_blank');
      } else {
        this.toastService.showNegativeToast('Download not available');
      }
      return;
    }

    this.toastService.showInfoToast(
      `Preparing "${this.truncate(track.title, 30)}"...`
    );

    try {
      const response = await firstValueFrom(
        this.http.post<DownloadResponse>(
          downloadUrl,
          {
            tracks: [
              {
                id: track.id,
                url: track.permalink_url,
                title: track.title,
                artist: track.user?.username || 'Unknown Artist',
              },
            ],
            username: this.userService.getUsername(),
          },
          { headers: this.authService.getXomcloudHeaders() }
        )
      );

      if (response?.data?.download_url) {
        window.open(response.data.download_url, '_blank');
        this.toastService.showPositiveToast('Download started!');
      } else {
        throw new Error('No download URL received');
      }
    } catch (error: unknown) {
      this.toastService.showNegativeToast(this.getErrorMessage(error));
    }
  }

  // ==================== Error Handling ====================

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Network error. Please check your connection.';
      }
      if (error.status === 504 || error.status === 408) {
        return 'Request timed out. The server may be busy.';
      }
      if (error.status === 401 || error.status === 403) {
        return 'Authentication failed. Please log in again.';
      }
      const serverMessage = error.error?.error?.message;
      if (typeof serverMessage === 'string') {
        return serverMessage;
      }
      return `Server error (${error.status}). Please try again.`;
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'Download failed. Please try again.';
  }

  // ==================== Utilities ====================

  private truncate(str: string, len: number): string {
    if (!str) return '';
    return str.length > len ? str.substring(0, len - 3) + '...' : str;
  }
}
