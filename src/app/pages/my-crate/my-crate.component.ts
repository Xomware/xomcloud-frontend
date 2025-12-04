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
  downloadProgress: DownloadProgress = { phase: 'idle', message: '', percentage: 0 };

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

    // Subscribe to download progress
    this.downloadService.getProgress$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(progress => {
        this.downloadProgress = progress;
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
    await this.downloadService.downloadQueue();
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
    return this.downloadProgress.message || '';
  }

  isDownloading(): boolean {
    return this.downloadProgress.phase !== 'idle' && this.downloadProgress.phase !== 'complete' && this.downloadProgress.phase !== 'error';
  }
}
