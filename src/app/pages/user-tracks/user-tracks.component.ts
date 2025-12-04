// user-tracks.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { Track } from '../../models';
import {
  TrackService,
  ToastService,
  DownloadQueueService,
} from '../../services';

@Component({
  selector: 'app-user-tracks',
  templateUrl: './user-tracks.component.html',
  styleUrls: ['./user-tracks.component.scss'],
})
export class UserTracksComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  userId: number | null = null;
  username: string = '';
  tracks: Track[] = [];
  loading = true;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private trackService: TrackService,
    private toastService: ToastService,
    private queueService: DownloadQueueService
  ) {}

  ngOnInit(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        this.userId = params['id'] ? +params['id'] : null;
        this.username = params['username'] || 'User';
        this.loadTracks();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTracks(): void {
    if (!this.userId) {
      this.error = 'No user specified';
      this.loading = false;
      return;
    }

    this.loading = true;
    this.error = null;

    this.trackService
      .getUserTracks(this.userId, 200)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false))
      )
      .subscribe({
        next: (tracks) => {
          this.tracks = tracks;
        },
        error: (err) => {
          console.error('Failed to load tracks:', err);
          this.error = 'Failed to load tracks. Please try again.';
          this.toastService.showNegativeToast('Failed to load tracks');
        },
      });
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
    if (!count) return '0';
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
  }

  onImageError(event: Event, fallbackSrc: string): void {
    const target = event.target as HTMLImageElement;
    if (target) target.src = fallbackSrc;
  }
}
