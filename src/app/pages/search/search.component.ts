// search.component.ts
import { Component, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, finalize, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Track } from '../../models';
import { TrackService, ToastService, DownloadQueueService } from '../../services';

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent implements OnDestroy {
  private destroy$ = new Subject<void>();
  private searchSubject$ = new Subject<string>();
  
  searchQuery = '';
  tracks: Track[] = [];
  loading = false;
  hasSearched = false;
  error: string | null = null;

  constructor(
    private trackService: TrackService,
    private toastService: ToastService,
    private queueService: DownloadQueueService
  ) {
    // Setup debounced search
    this.searchSubject$.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      if (query.trim()) {
        this.performSearch(query);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== Search ====================

  onSearchInput(): void {
    this.searchSubject$.next(this.searchQuery);
  }

  onSearchSubmit(): void {
    if (this.searchQuery.trim()) {
      this.performSearch(this.searchQuery);
    }
  }

  private performSearch(query: string): void {
    this.loading = true;
    this.error = null;
    this.hasSearched = true;

    this.trackService.searchTracks(query, 50, { access: 'playable' })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: (tracks) => {
          this.tracks = tracks;
          if (tracks.length === 0) {
            this.toastService.showInfoToast('No tracks found for your search');
          }
        },
        error: (err) => {
          console.error('Search failed:', err);
          this.error = 'Search failed. Please try again.';
          this.toastService.showNegativeToast('Search failed');
        }
      });
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.tracks = [];
    this.hasSearched = false;
    this.error = null;
  }

  // ==================== Queue Actions ====================

  addToQueue(track: Track): void {
    this.queueService.addToQueue(track);
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

  formatPlayCount(count: number): string {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    }
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count.toString();
  }

  onImageError(event: Event, fallbackSrc: string): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = fallbackSrc;
    }
  }
}
