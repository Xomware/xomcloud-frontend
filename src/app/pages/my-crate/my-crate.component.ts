// my-crate.component.ts - With selection for download (max 5 at a time)
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
  ToastService,
} from '../../services';

@Component({
  selector: 'app-my-crate',
  templateUrl: './my-crate.component.html',
  styleUrls: ['./my-crate.component.scss'],
})
export class MyCrateComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  queue: QueuedTrack[] = [];
  selectedTrackIds: Set<number> = new Set();
  isProcessing = false;
  downloadProgress: DownloadProgress = {
    phase: 'idle',
    message: '',
    currentTrack: '',
    current: 0,
    total: 0,
    percentage: 0,
  };

  readonly MAX_DOWNLOAD = 5;

  constructor(
    private queueService: DownloadQueueService,
    private downloadService: DownloadService,
    private trackService: TrackService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.queueService
      .getQueue$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((queue) => {
        this.queue = queue;
        // Clean up selections for removed tracks
        const queueIds = new Set(queue.map((q) => q.track.id));
        this.selectedTrackIds.forEach((id) => {
          if (!queueIds.has(id)) {
            this.selectedTrackIds.delete(id);
          }
        });
      });

    this.queueService
      .getIsProcessing$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((isProcessing) => {
        this.isProcessing = isProcessing;
      });

    this.downloadService
      .getProgress$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((progress) => {
        this.downloadProgress = progress;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== Selection ====================

  isSelected(trackId: number): boolean {
    return this.selectedTrackIds.has(trackId);
  }

  toggleSelection(trackId: number): void {
    if (this.selectedTrackIds.has(trackId)) {
      this.selectedTrackIds.delete(trackId);
    } else {
      if (this.selectedTrackIds.size >= this.MAX_DOWNLOAD) {
        this.toastService.showInfoToast(
          `Maximum ${this.MAX_DOWNLOAD} tracks per download`
        );
        return;
      }
      this.selectedTrackIds.add(trackId);
    }
  }

  isAllSelected(): boolean {
    const maxSelectable = Math.min(this.queue.length, this.MAX_DOWNLOAD);
    return this.selectedTrackIds.size === maxSelectable && maxSelectable > 0;
  }

  selectAll(): void {
    if (
      this.selectedTrackIds.size ===
      Math.min(this.queue.length, this.MAX_DOWNLOAD)
    ) {
      // Deselect all
      this.selectedTrackIds.clear();
    } else {
      // Select up to MAX_DOWNLOAD
      this.selectedTrackIds.clear();
      this.queue.slice(0, this.MAX_DOWNLOAD).forEach((item) => {
        this.selectedTrackIds.add(item.track.id);
      });
    }
  }

  getSelectedCount(): number {
    return this.selectedTrackIds.size;
  }

  // ==================== Queue Actions ====================

  removeFromQueue(trackId: number): void {
    this.queueService.removeFromQueue(trackId);
    this.selectedTrackIds.delete(trackId);
  }

  removeSelected(): void {
    if (this.selectedTrackIds.size === 0) return;

    this.selectedTrackIds.forEach((id) => {
      this.queueService.removeFromQueue(id);
    });
    this.selectedTrackIds.clear();
  }

  clearQueue(): void {
    if (this.queue.length === 0) return;

    if (confirm('Are you sure you want to clear your entire crate?')) {
      this.queueService.clearQueue();
      this.selectedTrackIds.clear();
    }
  }

  // ==================== Download ====================

  async downloadSelected(): Promise<void> {
    if (this.selectedTrackIds.size === 0) {
      this.toastService.showInfoToast('Select tracks to download (max 5)');
      return;
    }

    if (this.isProcessing) return;

    // Get selected tracks
    const selectedTracks = this.queue
      .filter((item) => this.selectedTrackIds.has(item.track.id))
      .map((item) => item.track);

    // Download selected
    const success = await this.downloadService.downloadSelected(selectedTracks);

    if (success) {
      // Remove downloaded tracks from queue
      selectedTracks.forEach((track) => {
        this.queueService.removeFromQueue(track.id);
      });
      this.selectedTrackIds.clear();
    }
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

  getSelectedDuration(): string {
    const selectedMs = this.queue
      .filter((item) => this.selectedTrackIds.has(item.track.id))
      .reduce((sum, item) => sum + item.track.duration, 0);

    const minutes = Math.floor(selectedMs / 60000);
    if (minutes >= 60) {
      return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    }
    return `${minutes} min`;
  }

  onImageError(event: Event, fallbackSrc: string): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = fallbackSrc;
    }
  }

  isDownloading(): boolean {
    return (
      this.downloadProgress.phase !== 'idle' &&
      this.downloadProgress.phase !== 'complete' &&
      this.downloadProgress.phase !== 'error'
    );
  }

  // Check if track is long (>8 min)
  isLongTrack(track: Track): boolean {
    return track.duration > 8 * 60 * 1000;
  }
}
