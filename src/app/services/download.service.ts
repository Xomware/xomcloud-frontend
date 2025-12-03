// download.service.ts - Handles track downloads and zip creation
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, from, of } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { Track } from '../models';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { DownloadQueueService, QueuedTrack } from './download-queue.service';
import { environment } from 'src/environments/environment';

declare var JSZip: any;

export interface DownloadProgress {
  currentTrack: number;
  totalTracks: number;
  currentTrackName: string;
  phase: 'fetching' | 'downloading' | 'zipping' | 'complete' | 'error';
  percentage: number;
}

@Injectable({
  providedIn: 'root'
})
export class DownloadService {
  private readonly apiBaseUrl = environment.apiBaseUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private toastService: ToastService,
    private queueService: DownloadQueueService
  ) {}

  // ==================== Stream URL Fetching ====================

  getStreamUrl(track: Track): Observable<string | null> {
    // First try to get from media transcodings
    if (track.media?.transcodings) {
      const progressive = track.media.transcodings.find(
        t => t.format.protocol === 'progressive' && t.format.mime_type === 'audio/mpeg'
      );
      
      if (progressive) {
        return this.http.get<{ url: string }>(progressive.url, {
          headers: this.authService.getAuthHeaders()
        }).pipe(
          map(response => response.url),
          catchError(() => this.fallbackStreamUrl(track.id))
        );
      }
    }

    return this.fallbackStreamUrl(track.id);
  }

  private fallbackStreamUrl(trackId: number): Observable<string | null> {
    return this.http.get<any>(`${this.apiBaseUrl}/tracks/${trackId}/streams`, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      map(response => response.http_mp3_128_url || response.hls_mp3_128_url || null),
      catchError(error => {
        console.error(`Failed to get stream URL for track ${trackId}:`, error);
        return of(null);
      })
    );
  }

  // ==================== Single Track Download ====================

  downloadSingleTrack(track: Track): void {
    this.toastService.showInfoToast(`Preparing "${track.title}" for download...`);
    
    this.getStreamUrl(track).subscribe({
      next: (url) => {
        if (url) {
          this.downloadFromUrl(url, this.sanitizeFilename(track.title) + '.mp3');
        } else {
          this.toastService.showNegativeToast('This track is not available for download');
        }
      },
      error: () => {
        this.toastService.showNegativeToast('Failed to get download URL');
      }
    });
  }

  private downloadFromUrl(url: string, filename: string): void {
    // Create a hidden link and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ==================== Bulk Download (Zip) ====================

  async downloadQueueAsZip(
    progressCallback?: (progress: DownloadProgress) => void
  ): Promise<boolean> {
    const queue = this.queueService.getQueue();
    
    if (queue.length === 0) {
      this.toastService.showNegativeToast('Your crate is empty');
      return false;
    }

    this.queueService.setProcessing(true);
    
    try {
      // Check if JSZip is available
      if (typeof JSZip === 'undefined') {
        await this.loadJSZip();
      }

      const zip = new JSZip();
      const folder = zip.folder('xomcloud-tracks');
      
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        
        if (progressCallback) {
          progressCallback({
            currentTrack: i + 1,
            totalTracks: queue.length,
            currentTrackName: item.track.title,
            phase: 'fetching',
            percentage: Math.round((i / queue.length) * 100)
          });
        }

        try {
          const streamUrl = await this.getStreamUrl(item.track).toPromise();
          
          if (streamUrl) {
            if (progressCallback) {
              progressCallback({
                currentTrack: i + 1,
                totalTracks: queue.length,
                currentTrackName: item.track.title,
                phase: 'downloading',
                percentage: Math.round(((i + 0.5) / queue.length) * 100)
              });
            }

            const audioBlob = await this.fetchAudioBlob(streamUrl);
            
            if (audioBlob) {
              const filename = this.sanitizeFilename(
                `${item.track.user.username} - ${item.track.title}`
              ) + '.mp3';
              folder.file(filename, audioBlob);
              successCount++;
            } else {
              failCount++;
            }
          } else {
            failCount++;
          }
        } catch (error) {
          console.error(`Failed to download track: ${item.track.title}`, error);
          failCount++;
        }
      }

      if (successCount === 0) {
        this.toastService.showNegativeToast('No tracks could be downloaded');
        this.queueService.setProcessing(false);
        return false;
      }

      if (progressCallback) {
        progressCallback({
          currentTrack: queue.length,
          totalTracks: queue.length,
          currentTrackName: 'Creating zip file...',
          phase: 'zipping',
          percentage: 95
        });
      }

      // Generate zip file
      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      // Download the zip
      const timestamp = new Date().toISOString().split('T')[0];
      this.downloadBlob(zipBlob, `xomcloud-crate-${timestamp}.zip`);

      if (progressCallback) {
        progressCallback({
          currentTrack: queue.length,
          totalTracks: queue.length,
          currentTrackName: 'Complete!',
          phase: 'complete',
          percentage: 100
        });
      }

      // Show results
      if (failCount > 0) {
        this.toastService.showInfoToast(
          `Downloaded ${successCount} tracks. ${failCount} tracks were unavailable.`
        );
      } else {
        this.toastService.showPositiveToast(
          `Successfully downloaded ${successCount} tracks!`
        );
      }

      return true;

    } catch (error) {
      console.error('Zip download failed:', error);
      this.toastService.showNegativeToast('Download failed. Please try again.');
      
      if (progressCallback) {
        progressCallback({
          currentTrack: 0,
          totalTracks: queue.length,
          currentTrackName: 'Error',
          phase: 'error',
          percentage: 0
        });
      }
      
      return false;
    } finally {
      this.queueService.setProcessing(false);
    }
  }

  private async fetchAudioBlob(url: string): Promise<Blob | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch audio');
      return await response.blob();
    } catch (error) {
      console.error('Failed to fetch audio blob:', error);
      return null;
    }
  }

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
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load JSZip'));
      document.head.appendChild(script);
    });
  }

  // ==================== Utilities ====================

  private sanitizeFilename(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200);
  }
}
