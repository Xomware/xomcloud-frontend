// playlists.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { Playlist, Track } from '../../models';
import { PlaylistService, TrackService, ToastService, DownloadQueueService } from '../../services';
import { onImageError } from '../../utils/shared.utils';

@Component({
  selector: 'app-playlists',
  templateUrl: './playlists.component.html',
  styleUrls: ['./playlists.component.scss']
})
export class PlaylistsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  playlists: Playlist[] = [];
  likedPlaylists: Playlist[] = [];
  loading = true;
  error: string | null = null;

  activeTab: 'my' | 'liked' = 'my';

  constructor(
    private router: Router,
    private playlistService: PlaylistService,
    private trackService: TrackService,
    private toastService: ToastService,
    private queueService: DownloadQueueService
  ) {}

  ngOnInit(): void {
    this.loadPlaylists();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPlaylists(): void {
    this.loading = true;
    this.error = null;

    this.playlistService.getUserPlaylists(false, 100)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: (playlists) => {
          this.playlists = playlists;
          this.loadLikedPlaylists();
        },
        error: () => {
          this.error = 'Failed to load your playlists. Please try again.';
          this.toastService.showNegativeToast('Failed to load playlists');
        }
      });
  }

  private loadLikedPlaylists(): void {
    this.playlistService.getLikedPlaylists(100)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (playlists) => {
          this.likedPlaylists = playlists;
        },
      });
  }

  setActiveTab(tab: 'my' | 'liked'): void {
    this.activeTab = tab;
  }

  getCurrentPlaylists(): Playlist[] {
    return this.activeTab === 'my' ? this.playlists : this.likedPlaylists;
  }

  goToPlaylist(playlist: Playlist): void {
    this.router.navigate(['/playlist'], { queryParams: { id: playlist.id } });
  }

  addPlaylistToQueue(playlist: Playlist): void {
    if (!playlist.tracks || playlist.tracks.length === 0) {
      this.playlistService.getPlaylistById(playlist.id, true)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (fullPlaylist) => {
            this.queueService.addMultipleToQueue(fullPlaylist.tracks);
          },
          error: () => {
            this.toastService.showNegativeToast('Failed to add playlist to crate');
          }
        });
    } else {
      this.queueService.addMultipleToQueue(playlist.tracks);
    }
  }

  isInQueue(trackId: number): boolean {
    return this.queueService.isInQueue(trackId);
  }

  getArtworkUrl(playlist: Playlist): string {
    return this.playlistService.getArtworkUrl(playlist, 't300x300');
  }

  getTrackArtwork(track: Track): string {
    return this.trackService.getArtworkUrl(track, 't67x67');
  }

  formatDuration(ms: number): string {
    return this.trackService.formatDuration(ms);
  }

  getTotalDuration(playlist: Playlist): string {
    return this.playlistService.getTotalDuration(playlist);
  }

  onImageError(event: Event, fallbackSrc: string): void {
    onImageError(event, fallbackSrc);
  }
}
