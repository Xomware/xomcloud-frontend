// liked-tracks.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { Track } from '../../models';
import { TrackService, ToastService, DownloadQueueService, UserService, AudioPreviewService } from '../../services';
import { formatNumber, onImageError } from '../../utils/shared.utils';

@Component({
  selector: 'app-liked-tracks',
  templateUrl: './liked-tracks.component.html',
  styleUrls: ['./liked-tracks.component.scss']
})
export class LikedTracksComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  tracks: Track[] = [];
  loading = true;
  loadingMore = false;
  error: string | null = null;

  nextUrl: string | null = null;
  hasMore = false;
  pageSize = 50;

  userId: number | null = null;
  username: string | null = null;
  isOwnLikes = true;
  isPrivate = false;

  selectionMode = false;
  selectedTracks: Set<number> = new Set();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private trackService: TrackService,
    private userService: UserService,
    private toastService: ToastService,
    private queueService: DownloadQueueService,
    private audioPreview: AudioPreviewService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['id']) {
        this.userId = +params['id'];
        this.username = params['username'] || null;
        this.isOwnLikes = false;
      } else {
        this.userId = null;
        this.username = null;
        this.isOwnLikes = true;
      }
      this.loadTracks();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTracks(): void {
    this.loading = true;
    this.error = null;
    this.tracks = [];
    this.isPrivate = false;

    const request = this.isOwnLikes
      ? this.trackService.getLikedTracksPaginated(this.pageSize)
      : this.trackService.getUserLikedTracksPaginated(this.userId!, this.pageSize);

    request.pipe(
      takeUntil(this.destroy$),
      finalize(() => this.loading = false)
    ).subscribe({
      next: (result) => {
        if (result.tracks.length === 0 && !this.isOwnLikes) {
          this.isPrivate = true;
          this.toastService.showInfoToast('This user\'s likes are private');
        }
        this.tracks = result.tracks;
        this.nextUrl = result.nextUrl;
        this.hasMore = result.hasMore;
      },
      error: (err) => {
        if (err.status === 403) {
          this.isPrivate = true;
          this.toastService.showInfoToast('This user\'s likes are private');
        } else {
          this.error = 'Failed to load liked tracks. Please try again.';
          this.toastService.showNegativeToast('Failed to load tracks');
        }
      }
    });
  }

  loadMore(): void {
    if (!this.hasMore || this.loadingMore || !this.nextUrl) return;

    this.loadingMore = true;

    const request = this.isOwnLikes
      ? this.trackService.getLikedTracksPaginated(this.pageSize, this.nextUrl)
      : this.trackService.getUserLikedTracksPaginated(this.userId!, this.pageSize, this.nextUrl);

    request.pipe(
      takeUntil(this.destroy$),
      finalize(() => this.loadingMore = false)
    ).subscribe({
      next: (result) => {
        this.tracks = [...this.tracks, ...result.tracks];
        this.nextUrl = result.nextUrl;
        this.hasMore = result.hasMore;
      },
      error: () => {
        this.toastService.showNegativeToast('Failed to load more tracks');
      }
    });
  }

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

  getArtworkUrl(track: Track): string {
    return this.trackService.getArtworkUrl(track, 't300x300');
  }

  formatDuration(ms: number): string {
    return this.trackService.formatDuration(ms);
  }

  onImageError(event: Event, fallbackSrc: string): void {
    onImageError(event, fallbackSrc);
  }

  formatPlayCount(count: number): string {
    return formatNumber(count);
  }

  getPageTitle(): string {
    if (this.isOwnLikes) {
      return 'Liked Tracks';
    }
    return this.username ? `${this.username}'s Likes` : 'Liked Tracks';
  }

  goBackToProfile(): void {
    if (this.userId) {
      this.router.navigate(['/user-profile'], {
        queryParams: { id: this.userId, username: this.username }
      });
    }
  }

  togglePlay(track: Track): void {
    this.audioPreview.toggle(track);
  }

  isTrackPlaying(trackId: number): boolean {
    return this.audioPreview.isPlaying(trackId);
  }
}
