// download.service.ts - Uses Lambda Function URL for downloads (no timeout limit)
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { Track } from '../models';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { DownloadQueueService } from './download-queue.service';
import { environment } from 'src/environments/environment';

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

  // Simulated progress for long-running downloads
  private progressInterval: any = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
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
  // Since we can't get real-time progress from Lambda, we simulate it

  private startProgressSimulation(total: number): void {
    this.stopProgressSimulation();

    let simulated = 0;
    const estimatedTimePerTrack = 8000; // ~8 seconds per track
    const updateInterval = 500; // Update every 500ms
    const incrementPerUpdate =
      100 / ((total * estimatedTimePerTrack) / updateInterval);

    this.progressInterval = setInterval(() => {
      simulated = Math.min(simulated + incrementPerUpdate, 95); // Cap at 95%

      const currentTrack = Math.min(
        Math.ceil((simulated / 100) * total),
        total
      );
      this.setProgress(
        'processing',
        `Processing track ${currentTrack} of ${total}...`,
        '',
        currentTrack,
        total
      );
    }, updateInterval);
  }

  private stopProgressSimulation(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  // ==================== Main Download ====================

  async downloadQueue(): Promise<boolean> {
    const queue = this.queueService.getQueue();

    if (queue.length === 0) {
      this.toastService.showNegativeToast('Your crate is empty');
      return false;
    }

    if (queue.length > 10) {
      this.toastService.showNegativeToast(
        'Maximum 10 tracks per download. Please remove some tracks.'
      );
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
        'Preparing download request...',
        '',
        0,
        queue.length
      );

      // Build request payload
      const tracks = queue.map((item) => ({
        id: item.track.id,
        url: item.track.permalink_url,
        title: item.track.title,
        artist: item.track.user?.username || 'Unknown Artist',
      }));

      this.setProgress(
        'uploading',
        'Sending to server...',
        '',
        0,
        queue.length
      );

      // Start progress simulation
      this.startProgressSimulation(queue.length);

      // Call Lambda (Function URL has no timeout, can take several minutes)
      const response = await this.http
        .post<DownloadResponse>(
          downloadUrl,
          { tracks },
          {
            headers: this.authService.getAuthHeaders(),
            // No timeout - Lambda Function URL can run up to 15 min
          }
        )
        .toPromise();

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

      // Open the presigned S3 URL to download the zip
      window.open(data.download_url, '_blank');

      // Show result message
      if (data.failed_count > 0) {
        const failedNames = data.failed
          ?.slice(0, 3)
          .map((f) => f.title)
          .join(', ');
        const moreText =
          data.failed_count > 3 ? ` and ${data.failed_count - 3} more` : '';
        this.toastService.showInfoToast(
          `Downloaded ${data.successful}/${data.total} tracks. Failed: ${failedNames}${moreText}`
        );
      } else {
        this.toastService.showPositiveToast(
          `Successfully downloaded ${data.successful} tracks!`
        );
      }

      setTimeout(() => this.resetProgress(), 4000);
      return true;
    } catch (error: any) {
      this.stopProgressSimulation();
      console.error('Download failed:', error);

      const errorMessage = this.getErrorMessage(error);
      this.setProgress('error', errorMessage, '', 0, 0);
      this.toastService.showNegativeToast(errorMessage);

      setTimeout(() => this.resetProgress(), 4000);
      return false;
    } finally {
      this.queueService.setProcessing(false);
    }
  }

  // ==================== Single Track Download ====================

  async downloadSingleTrack(track: Track): Promise<void> {
    const downloadUrl = environment.downloadApiUrl;

    if (!downloadUrl) {
      // Fallback: try to open SoundCloud page
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
      const response = await this.http
        .post<DownloadResponse>(
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
          },
          { headers: this.authService.getAuthHeaders() }
        )
        .toPromise();

      if (response?.data?.download_url) {
        window.open(response.data.download_url, '_blank');
        this.toastService.showPositiveToast('Download started!');
      } else {
        throw new Error('No download URL received');
      }
    } catch (error: any) {
      console.error('Single track download failed:', error);
      this.toastService.showNegativeToast(this.getErrorMessage(error));
    }
  }

  // ==================== Error Handling ====================

  private getErrorMessage(error: any): string {
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
      if (error.error?.error?.message) {
        return error.error.error.message;
      }
      return `Server error (${error.status}). Please try again.`;
    }

    if (error?.message) {
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
