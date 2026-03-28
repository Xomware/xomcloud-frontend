import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PlaylistService } from '../../services/playlist.service';
import { DownloadQueueService } from '../../services/download-queue.service';
import { ToastService } from '../../services/toast.service';
import { AudioPreviewService } from '../../services/audio-preview.service';
import { Track, Playlist } from '../../models';
import { onImageError } from '../../utils/shared.utils';

@Component({
  selector: 'app-playlist-detail',
  templateUrl: './playlist-detail.component.html',
  styleUrls: ['./playlist-detail.component.scss']
})
export class PlaylistDetailComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  playlist: Playlist | null = null;
  tracks: Track[] = [];
  loading = true;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private playlistService: PlaylistService,
    private queueService: DownloadQueueService,
    private toastService: ToastService,
    private audioPreview: AudioPreviewService
  ) {}

  ngOnInit(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const playlistId = params['id'];
        if (playlistId) {
          this.loadPlaylist(+playlistId);
        } else {
          this.error = 'No playlist ID provided';
          this.loading = false;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPlaylist(playlistId: number): void {
    this.loading = true;
    this.playlistService.getPlaylistById(playlistId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (playlist) => {
          this.playlist = playlist;
          this.tracks = playlist.tracks || [];
          this.loading = false;
        },
        error: () => {
          this.error = 'Failed to load playlist';
          this.loading = false;
        }
      });
  }

  isInQueue(trackId: number): boolean {
    return this.queueService.isInQueue(trackId);
  }

  addToQueue(track: Track): void {
    this.queueService.addToQueue(track);
  }

  addAllToQueue(): void {
    const added = this.queueService.addMultipleToQueue(this.tracks);
    if (added === 0) {
      this.toastService.showInfoToast('All tracks already in crate');
    }
  }

  goToArtist(userId: number, username: string): void {
    this.router.navigate(['/user-profile'], {
      queryParams: { id: userId, username }
    });
  }

  goBack(): void {
    window.history.back();
  }

  getArtworkUrl(track: Track): string {
    return track.artwork_url?.replace('-large', '-t300x300') ||
           track.user?.avatar_url?.replace('-large', '-t300x300') ||
           'assets/img/default-artwork.svg';
  }

  getPlaylistArtwork(): string {
    return this.playlist?.artwork_url?.replace('-large', '-t500x500') ||
           this.tracks[0]?.artwork_url?.replace('-large', '-t500x500') ||
           'assets/img/default-artwork.svg';
  }

  formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  getTotalDuration(): string {
    const totalMs = this.tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
    const totalMinutes = Math.floor(totalMs / 60000);
    if (totalMinutes >= 60) {
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      return `${hours}h ${mins}m`;
    }
    return `${totalMinutes} min`;
  }

  togglePlay(track: Track): void {
    this.audioPreview.toggle(track);
  }

  isTrackPlaying(trackId: number): boolean {
    return this.audioPreview.isPlaying(trackId);
  }

  onImageError(event: Event, fallbackSrc: string): void {
    onImageError(event, fallbackSrc);
  }
}
