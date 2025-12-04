// download.service.ts - Client-side track downloads
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
  active: boolean;
  message: string;
  current: number;
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class DownloadService {
  private readonly soundcloudApi = environment.apiBaseUrl;
  
  private progress$ = new BehaviorSubject<DownloadProgress>({
    active: false,
    message: '',
    current: 0,
    total: 0
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

  private setProgress(active: boolean, message: string, current: number = 0, total: number = 0): void {
    this.progress$.next({ active, message, current, total });
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
      if (typeof JSZip === 'undefined') {
        this.setProgress(true, 'Preparing...', 0, queue.length);
        await this.loadJSZip();
      }

      const zip = new JSZip();
      const folder = zip.folder('xomcloud-tracks');
      
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        const displayTitle = this.truncate(item.track.title, 35);
        
        this.setProgress(true, `Downloading: ${displayTitle}`, i + 1, queue.length);

        try {
          const streamUrl = await firstValueFrom(this.getStreamUrl(item.track));
          
          if (streamUrl) {
            const audioBlob = await this.fetchAudioBlob(streamUrl);
            
            if (audioBlob) {
              const filename = this.sanitizeFilename(
                `${item.track.user?.username || 'Unknown'} - ${item.track.title}`
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
          console.error(`Failed: ${item.track.title}`, error);
          failCount++;
        }
      }

      if (successCount === 0) {
        this.setProgress(false, '', 0, 0);
        this.toastService.showNegativeToast('No tracks available for download');
        return false;
      }

      this.setProgress(true, 'Creating zip file...', queue.length, queue.length);

      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      const timestamp = new Date().toISOString().split('T')[0];
      this.downloadBlob(zipBlob, `xomcloud-${timestamp}.zip`);

      this.setProgress(false, '', 0, 0);
      
      if (failCount > 0) {
        this.toastService.showInfoToast(`Downloaded ${successCount} tracks. ${failCount} unavailable.`);
      } else {
        this.toastService.showPositiveToast(`Downloaded ${successCount} tracks!`);
      }

      return true;

    } catch (error) {
      console.error('Download failed:', error);
      this.setProgress(false, '', 0, 0);
      this.toastService.showNegativeToast('Download failed. Please try again.');
      return false;
      
    } finally {
      this.queueService.setProcessing(false);
    }
  }

  // ==================== Single Track ====================

  downloadSingleTrack(track: Track): void {
    this.toastService.showInfoToast(`Preparing "${this.truncate(track.title, 25)}"...`);
    
    this.getStreamUrl(track).subscribe({
      next: (url) => {
        if (url) {
          const link = document.createElement('a');
          link.href = url;
          link.download = this.sanitizeFilename(track.title) + '.mp3';
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          this.toastService.showPositiveToast('Download started!');
        } else {
          this.toastService.showNegativeToast('Track not available for download');
        }
      },
      error: () => {
        this.toastService.showNegativeToast('Download failed');
      }
    });
  }

  // ==================== Stream URL ====================

  getStreamUrl(track: Track): Observable<string | null> {
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
    return this.http.get<any>(`${this.soundcloudApi}/tracks/${trackId}/streams`, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      map(response => response.http_mp3_128_url || response.hls_mp3_128_url || null),
      catchError(() => of(null))
    );
  }

  // ==================== Utilities ====================

  private async fetchAudioBlob(url: string): Promise<Blob | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      return await response.blob();
    } catch {
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
      if (typeof JSZip !== 'undefined') {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
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
