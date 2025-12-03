// my-crate.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Track } from '../../models';
import { 
  DownloadQueueService, 
  QueuedTrack,
  DownloadService,
  DownloadProgress,
  TrackService,
  ToastService 
} from '../../services';

@Component({
  selector: 'app-my-crate',
  templateUrl: './my-crate.component.html',
  styleUrls: ['./my-crate.component.scss']
})
export class MyCrateComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  queue: QueuedTrack[] = [];
  isProcessing = false;
  downloadProgress: DownloadProgress | null = null;

  constructor(
    private queueService: DownloadQueueService,
    private downloadService: DownloadService,
    private trackService: TrackService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    // Subscribe to queue changes
    this.queueService.getQueue$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(queue => {
        this.queue = queue;
      });

    // Subscribe to processing state
    this.queueService.getIsProcessing$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(isProcessing => {
        this.isProcessing = isProcessing;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== Queue Actions ====================

  removeFromQueue(trackId: number): void {
    this.queueService.removeFromQueue(trackId);
  }

  clearQueue(): void {
    if (this.queue.length === 0) return;
    
    if (confirm('Are you sure you want to clear your entire crate?')) {
      this.queueService.clearQueue();
    }
  }

  // ==================== Download ====================

  async startDownload(): Promise<void> {
    if (this.queue.length === 0 || this.isProcessing) return;

    this.downloadProgress = {
      currentTrack: 0,
      totalTracks: this.queue.length,
      currentTrackName: 'Starting...',
      phase: 'fetching',
      percentage: 0
    };

    const success = await this.downloadService.downloadQueueAsZip(
      (progress) => {
        this.downloadProgress = progress;
      }
    );

    if (success) {
      // Optionally clear the queue after successful download
      // this.queueService.clearQueue();
    }

    // Reset progress after a delay
    setTimeout(() => {
      this.downloadProgress = null;
    }, 3000);
  }

  downloadSingleTrack(track: Track): void {
    this.downloadService.downloadSingleTrack(track);
  }

  // ==================== Utilities ====================

  getArtworkUrl(track: Track): string {
    return this.trackService.getArtworkUrl(track, 't67x67');
  }

  formatDuration(ms: number): string {
    return this.trackService.formatDuration(ms);
  }

  getTotalDuration(): string {
    return this.queueService.formatTotalDuration();
  }

  onImageError(event: Event, fallbackSrc: string): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = fallbackSrc;
    }
  }

  getProgressPhaseText(): string {
    if (!this.downloadProgress) return '';
    
    switch (this.downloadProgress.phase) {
      case 'fetching':
        return 'Getting stream URL...';
      case 'downloading':
        return 'Downloading audio...';
      case 'zipping':
        return 'Creating zip file...';
      case 'complete':
        return 'Download complete!';
      case 'error':
        return 'Download failed';
      default:
        return '';
    }
  }
}
