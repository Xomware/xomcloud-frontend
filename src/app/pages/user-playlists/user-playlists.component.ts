// user-playlists.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { Playlist } from '../../models';
import { UserService, PlaylistService, ToastService } from '../../services';

@Component({
  selector: 'app-user-playlists',
  templateUrl: './user-playlists.component.html',
  styleUrls: ['./user-playlists.component.scss'],
})
export class UserPlaylistsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  userId: number | null = null;
  username: string = '';
  playlists: Playlist[] = [];
  loading = true;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private userService: UserService,
    private playlistService: PlaylistService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        this.userId = params['id'] ? +params['id'] : null;
        this.username = params['username'] || 'User';
        this.loadPlaylists();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPlaylists(): void {
    if (!this.userId) {
      this.error = 'No user specified';
      this.loading = false;
      return;
    }

    this.loading = true;
    this.error = null;

    this.userService
      .getUserPlaylists(this.userId, 100)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false))
      )
      .subscribe({
        next: (playlists) => {
          this.playlists = playlists;
        },
        error: (err) => {
          console.error('Failed to load playlists:', err);
          this.error = 'Failed to load playlists. Please try again.';
          this.toastService.showNegativeToast('Failed to load playlists');
        },
      });
  }

  getArtworkUrl(playlist: Playlist): string {
    return this.playlistService.getArtworkUrl(playlist, 't300x300');
  }

  getTotalDuration(playlist: Playlist): string {
    return this.playlistService.getTotalDuration(playlist);
  }

  onImageError(event: Event, fallbackSrc: string): void {
    const target = event.target as HTMLImageElement;
    if (target) target.src = fallbackSrc;
  }
}
