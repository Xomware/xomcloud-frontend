// download.service.ts - Client-side track downloads with progress bar
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, firstValueFrom } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Track } from '../models';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { DownloadQueueService } from './download-queue.service';
import { environment } from 'src/environments/environment';

declare var JSZip: any;

export interface DownloadProgress {
  phase:
    | 'idle'
    | 'preparing'
    | 'downloading'
    | 'zipping'
    | 'complete'
    | 'error';
  message: string;
  currentTrack: string;
  current: number;
  total: number;
  percentage: number;
}

@Injectable({
  providedIn: 'root',
})
export class DownloadService {
  private readonly soundcloudApi = environment.apiBaseUrl;

  private progress$ = new BehaviorSubject<DownloadProgress>({
    phase: 'idle',
    message: '',
    currentTrack: '',
    current: 0,
    total: 0,
    percentage: 0,
  });

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

  // ==================== Main Download ====================

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
      // Load JSZip
      this.setProgress('preparing', 'Loading...', '', 0, queue.length);
      if (typeof JSZip === 'undefined') {
        await this.loadJSZip();
      }

      const zip = new JSZip();
      const folder = zip.folder('xomcloud-tracks');

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        const displayTitle = this.truncate(item.track.title, 40);
        const artist = item.track.user?.username || 'Unknown';

        this.setProgress(
          'downloading',
          `Downloading ${i + 1} of ${queue.length}`,
          `${artist} - ${displayTitle}`,
          i + 1,
          queue.length
        );

        try {
          // Get the stream URL with auth
          const streamUrl = await firstValueFrom(this.getStreamUrl(item.track));

          if (streamUrl) {
            // Fetch audio using HttpClient with blob response
            const audioBlob = await this.fetchAudioWithAuth(streamUrl);

            if (audioBlob && audioBlob.size > 0) {
              const filename =
                this.sanitizeFilename(`${artist} - ${item.track.title}`) +
                '.mp3';
              folder.file(filename, audioBlob);
              successCount++;
            } else {
              console.warn(`Empty or null blob for: ${item.track.title}`);
              failCount++;
            }
          } else {
            console.warn(`No stream URL for: ${item.track.title}`);
            failCount++;
          }
        } catch (error) {
          console.error(`Failed to download: ${item.track.title}`, error);
          failCount++;
        }
      }

      if (successCount === 0) {
        this.setProgress('error', 'No tracks could be downloaded', '', 0, 0);
        this.toastService.showNegativeToast('No tracks available for download');
        setTimeout(() => this.resetProgress(), 3000);
        return false;
      }

      this.setProgress(
        'zipping',
        'Creating zip file...',
        '',
        queue.length,
        queue.length
      );

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const timestamp = new Date().toISOString().split('T')[0];
      this.downloadBlob(zipBlob, `xomcloud-${timestamp}.zip`);

      this.setProgress(
        'complete',
        'Download complete!',
        '',
        queue.length,
        queue.length
      );

      if (failCount > 0) {
        this.toastService.showInfoToast(
          `Downloaded ${successCount} tracks. ${failCount} unavailable.`
        );
      } else {
        this.toastService.showPositiveToast(
          `Downloaded ${successCount} tracks!`
        );
      }

      setTimeout(() => this.resetProgress(), 3000);
      return true;
    } catch (error) {
      console.error('Download failed:', error);
      this.setProgress('error', 'Download failed. Please try again.', '', 0, 0);
      this.toastService.showNegativeToast('Download failed. Please try again.');
      setTimeout(() => this.resetProgress(), 3000);
      return false;
    } finally {
      this.queueService.setProcessing(false);
    }
  }

  // ==================== Single Track ====================

  downloadSingleTrack(track: Track): void {
    this.toastService.showInfoToast(
      `Preparing "${this.truncate(track.title, 25)}"...`
    );

    this.getStreamUrl(track).subscribe({
      next: (url) => {
        if (url) {
          // For single track, open in new tab (browser handles download)
          window.open(url, '_blank');
          this.toastService.showPositiveToast('Download started!');
        } else {
          this.toastService.showNegativeToast(
            'Track not available for download'
          );
        }
      },
      error: () => {
        this.toastService.showNegativeToast('Download failed');
      },
    });
  }

  // ==================== Stream URL ====================

  getStreamUrl(track: Track): Observable<string | null> {
    // Try progressive MP3 first (direct download)
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
            catchError((err) => {
              console.warn('Progressive URL failed, trying fallback', err);
              return this.fallbackStreamUrl(track.id);
            })
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
        map((response) => {
          // Try different stream formats in order of preference
          return (
            response.http_mp3_128_url ||
            response.progressive_mp3_url ||
            response.hls_mp3_128_url ||
            null
          );
        }),
        catchError((err) => {
          console.error('Stream URL fetch failed:', err);
          return of(null);
        })
      );
  }

  // ==================== Fetch Audio ====================

  private async fetchAudioWithAuth(url: string): Promise<Blob | null> {
    try {
      // The stream URL from SoundCloud should already be signed
      // Try fetching directly first
      const response = await fetch(url);

      if (response.ok) {
        return await response.blob();
      }

      // If direct fetch fails, the URL might need the OAuth token
      // This shouldn't normally happen with SoundCloud's signed URLs
      console.warn('Direct fetch failed, status:', response.status);
      return null;
    } catch (error) {
      console.error('Fetch audio error:', error);
      return null;
    }
  }

  // ==================== Utilities ====================

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private async loadJSZip(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof JSZip !== 'undefined') {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src =
        'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load JSZip'));
      document.head.appendChild(script);
    });
  }

  private sanitizeFilename(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200);
  }

  private truncate(str: string, len: number): string {
    return str.length > len ? str.substring(0, len - 3) + '...' : str;
  }
}
