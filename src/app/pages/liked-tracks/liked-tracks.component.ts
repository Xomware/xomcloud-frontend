// liked-tracks.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { Track } from '../../models';
import { TrackService, ToastService, DownloadQueueService } from '../../services';

@Component({
  selector: 'app-liked-tracks',
  templateUrl: './liked-tracks.component.html',
  styleUrls: ['./liked-tracks.component.scss']
})
export class LikedTracksComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  tracks: Track[] = [];
  loading = true;
  error: string | null = null;
  
  // Selection mode
  selectionMode = false;
  selectedTracks: Set<number> = new Set();

  constructor(
    private trackService: TrackService,
    private toastService: ToastService,
    private queueService: DownloadQueueService
  ) {}

  ngOnInit(): void {
    this.loadTracks();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTracks(): void {
    this.loading = true;
    this.error = null;

    this.trackService.getLikedTracks(200)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: (tracks) => {
          this.tracks = tracks;
        },
        error: (err) => {
          console.error('Failed to load liked tracks:', err);
          this.error = 'Failed to load your liked tracks. Please try again.';
          this.toastService.showNegativeToast('Failed to load tracks');
        }
      });
  }

  // ==================== Selection ====================

  toggleSelectionMode(): void {
    this.selectionMode = !this.selectionMode;
    if (!this.selectionMode) {
      this.selectedTracks.clear();
    }
  }

  toggleTrackSelection(trackId: number): void {
    if (this.selectedTracks.has(trackId)) {
      this.selectedTracks.delete(trackId);
    } else {
      this.selectedTracks.add(trackId);
    }
  }

  isSelected(trackId: number): boolean {
    return this.selectedTracks.has(trackId);
  }

  selectAll(): void {
    this.tracks.forEach(track => this.selectedTracks.add(track.id));
  }

  clearSelection(): void {
    this.selectedTracks.clear();
  }

  // ==================== Queue Actions ====================

  addToQueue(track: Track): void {
    this.queueService.addToQueue(track);
  }

  addSelectedToQueue(): void {
    const selectedTrackObjects = this.tracks.filter(t => this.selectedTracks.has(t.id));
    const added = this.queueService.addMultipleToQueue(selectedTrackObjects);
    
    if (added > 0) {
      this.selectionMode = false;
      this.selectedTracks.clear();
    }
  }

  isInQueue(trackId: number): boolean {
    return this.queueService.isInQueue(trackId);
  }

  // ==================== Utilities ====================

  getArtworkUrl(track: Track): string {
    return this.trackService.getArtworkUrl(track, 't300x300');
  }

  formatDuration(ms: number): string {
    return this.trackService.formatDuration(ms);
  }

  onImageError(event: Event, fallbackSrc: string): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = fallbackSrc;
    }
  }

  formatPlayCount(count: number): string {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    }
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count.toString();
  }
}
