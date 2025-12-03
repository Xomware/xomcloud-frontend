// playlists.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { Playlist, Track } from '../../models';
import { PlaylistService, TrackService, ToastService, DownloadQueueService } from '../../services';

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
  
  // Expanded playlist view
  expandedPlaylist: Playlist | null = null;
  loadingTracks = false;

  activeTab: 'my' | 'liked' = 'my';

  constructor(
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
        error: (err) => {
          console.error('Failed to load playlists:', err);
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
        error: (err) => console.error('Failed to load liked playlists:', err)
      });
  }

  // ==================== Tab Navigation ====================

  setActiveTab(tab: 'my' | 'liked'): void {
    this.activeTab = tab;
    this.expandedPlaylist = null;
  }

  getCurrentPlaylists(): Playlist[] {
    return this.activeTab === 'my' ? this.playlists : this.likedPlaylists;
  }

  // ==================== Playlist Expansion ====================

  expandPlaylist(playlist: Playlist): void {
    if (this.expandedPlaylist?.id === playlist.id) {
      this.expandedPlaylist = null;
      return;
    }

    if (playlist.tracks && playlist.tracks.length > 0) {
      this.expandedPlaylist = playlist;
      return;
    }

    this.loadingTracks = true;
    this.playlistService.getPlaylistById(playlist.id, true)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loadingTracks = false)
      )
      .subscribe({
        next: (fullPlaylist) => {
          this.expandedPlaylist = fullPlaylist;
          // Update in cache
          const index = this.playlists.findIndex(p => p.id === playlist.id);
          if (index !== -1) {
            this.playlists[index] = fullPlaylist;
          }
        },
        error: (err) => {
          console.error('Failed to load playlist tracks:', err);
          this.toastService.showNegativeToast('Failed to load tracks');
        }
      });
  }

  closeExpandedPlaylist(): void {
    this.expandedPlaylist = null;
  }

  // ==================== Queue Actions ====================

  addTrackToQueue(track: Track): void {
    this.queueService.addToQueue(track);
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

  // ==================== Utilities ====================

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
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = fallbackSrc;
    }
  }
}
