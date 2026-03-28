// my-profile.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { User, Track, Playlist } from '../../models';
import {
  UserService,
  TrackService,
  PlaylistService,
  ToastService,
} from '../../services';
import { formatNumber, onImageError } from '../../utils/shared.utils';

@Component({
  selector: 'app-my-profile',
  templateUrl: './my-profile.component.html',
  styleUrls: ['./my-profile.component.scss'],
})
export class MyProfileComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  user: User | null = null;
  recentTracks: Track[] = [];
  playlists: Playlist[] = [];

  loading = true;
  error: string | null = null;
  bioExpanded = false;

  stats = {
    tracks: 0,
    playlists: 0,
    followers: 0,
    followings: 0,
    likes: 0,
  };

  constructor(
    private userService: UserService,
    private trackService: TrackService,
    private playlistService: PlaylistService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadProfile(): void {
    this.loading = true;
    this.error = null;

    this.userService
      .fetchCurrentUser()
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
        error: () => {
          this.error = 'Failed to load your profile. Please try again.';
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
    this.trackService
      .getLikedTracks(6)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tracks) => (this.recentTracks = tracks),
      });

    this.playlistService
      .getUserPlaylists(false, 6)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (playlists) => (this.playlists = playlists),
      });
  }

  getAvatarUrl(size: string = 'large'): string {
    if (!this.user?.avatar_url) {
      return 'assets/img/default-avatar.svg';
    }
    return this.user.avatar_url.replace('large', size);
  }

  formatNumber(num: number): string {
    return formatNumber(num);
  }

  getTrackArtwork(track: Track): string {
    return this.trackService.getArtworkUrl(track, 't300x300');
  }

  getPlaylistArtwork(playlist: Playlist): string {
    return this.playlistService.getArtworkUrl(playlist, 't300x300');
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
    onImageError(event, fallbackSrc);
  }
}
