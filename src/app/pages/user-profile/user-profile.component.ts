// user-profile.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { User, Track, Playlist } from '../../models';
import {
  UserService,
  TrackService,
  PlaylistService,
  ToastService,
  DownloadQueueService,
} from '../../services';

@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.scss'],
})
export class UserProfileComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  userId: number | null = null;
  user: User | null = null;
  recentTracks: Track[] = [];
  likedTracks: Track[] = [];
  playlists: Playlist[] = [];

  loading = true;
  error: string | null = null;
  likesPrivate = false;
  bioExpanded = false;

  stats = {
    tracks: 0,
    playlists: 0,
    followers: 0,
    followings: 0,
    likes: 0,
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService,
    private trackService: TrackService,
    private playlistService: PlaylistService,
    private toastService: ToastService,
    private queueService: DownloadQueueService
  ) {}

  ngOnInit(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        this.userId = params['id'] ? +params['id'] : null;
        this.loadProfile();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadProfile(): void {
    if (!this.userId) {
      this.error = 'No user specified';
      this.loading = false;
      return;
    }

    this.loading = true;
    this.error = null;
    this.likesPrivate = false;

    this.userService
      .getUserById(this.userId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false))
      )
      .subscribe({
        next: (user) => {
          this.user = user;
          this.updateStats(user);
          this.loadAdditionalData();
        },
        error: (err) => {
          console.error('Failed to load profile:', err);
          this.error = 'Failed to load profile. Please try again.';
          this.toastService.showNegativeToast('Failed to load profile');
        },
      });
  }

  private updateStats(user: User): void {
    this.stats = {
      tracks: user.track_count || 0,
      playlists: user.playlist_count || 0,
      followers: user.followers_count || 0,
      followings: user.followings_count || 0,
      likes: user.likes_count ?? user.public_favorites_count ?? 0,
    };
  }

  private loadAdditionalData(): void {
    if (!this.userId) return;

    // Load user's tracks
    this.trackService
      .getUserTracks(this.userId, 6)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tracks) => (this.recentTracks = tracks),
        error: (err) => console.error('Failed to load tracks:', err),
      });

    // Load user's liked tracks
    this.trackService
      .getUserLikedTracks(this.userId, 6)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tracks) => {
          this.likedTracks = tracks;
          if (tracks.length === 0 && this.stats.likes > 0) {
            this.likesPrivate = true;
          }
        },
        error: (err) => {
          console.error('Failed to load liked tracks:', err);
          if (err.status === 403) {
            this.likesPrivate = true;
          }
        },
      });

    // Load user's playlists
    this.userService
      .getUserPlaylists(this.userId, 6)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (playlists) => (this.playlists = playlists),
        error: (err) => console.error('Failed to load playlists:', err),
      });
  }

  // ==================== Crate Actions ====================

  addToQueue(track: Track): void {
    this.queueService.addToQueue(track);
  }

  isInQueue(trackId: number): boolean {
    return this.queueService.isInQueue(trackId);
  }

  // ==================== Navigation ====================

  goToTracks(): void {
    if (this.user) {
      this.router.navigate(['/user-tracks'], {
        queryParams: { id: this.user.id, username: this.user.username },
      });
    }
  }

  goToPlaylists(): void {
    if (this.user) {
      this.router.navigate(['/user-playlists'], {
        queryParams: { id: this.user.id, username: this.user.username },
      });
    }
  }

  goToFollowers(): void {
    if (this.user) {
      this.router.navigate(['/followers'], {
        queryParams: { id: this.user.id, username: this.user.username },
      });
    }
  }

  goToFollowing(): void {
    if (this.user) {
      this.router.navigate(['/following'], {
        queryParams: { id: this.user.id, username: this.user.username },
      });
    }
  }

  goToLikes(): void {
    if (this.user) {
      if (this.likesPrivate) {
        this.toastService.showInfoToast("This user's likes are private");
        return;
      }
      this.router.navigate(['/liked-tracks'], {
        queryParams: { id: this.user.id, username: this.user.username },
      });
    }
  }

  // ==================== Utilities ====================

  getAvatarUrl(size: string = 'large'): string {
    if (!this.user?.avatar_url) return 'assets/img/default-avatar.png';
    return this.user.avatar_url.replace('large', size);
  }

  getTrackArtwork(track: Track): string {
    return this.trackService.getArtworkUrl(track, 't300x300');
  }

  getPlaylistArtwork(playlist: Playlist): string {
    return this.playlistService.getArtworkUrl(playlist, 't300x300');
  }

  formatNumber(num: number): string {
    if (num === null || num === undefined || isNaN(num)) {
      return '0';
    }
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  getJoinDate(): string {
    if (!this.user?.created_at) return '';
    const date = new Date(this.user.created_at);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  openSoundCloudProfile(): void {
    if (this.user?.permalink_url) {
      window.open(this.user.permalink_url, '_blank');
    }
  }

  onImageError(event: Event, fallbackSrc: string): void {
    const target = event.target as HTMLImageElement;
    if (target) target.src = fallbackSrc;
  }
}
