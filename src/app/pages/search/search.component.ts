// search.component.ts
import { Component, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, finalize, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Track } from '../../models';
import { TrackService, ToastService, DownloadQueueService } from '../../services';
import { formatNumber, onImageError } from '../../utils/shared.utils';

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
        error: () => {
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

  addToQueue(track: Track): void {
    this.queueService.addToQueue(track);
  }

  isInQueue(trackId: number): boolean {
    return this.queueService.isInQueue(trackId);
  }

  getArtworkUrl(track: Track): string {
    return this.trackService.getArtworkUrl(track, 't300x300');
  }

  formatDuration(ms: number): string {
    return this.trackService.formatDuration(ms);
  }

  formatPlayCount(count: number): string {
    return formatNumber(count);
  }

  onImageError(event: Event, fallbackSrc: string): void {
    onImageError(event, fallbackSrc);
  }
}
