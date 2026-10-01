// app.component.ts
import { Component, OnDestroy, OnInit, ViewChild, ViewContainerRef, signal } from '@angular/core';
import { AuthService } from './services/auth.service';
import { UserService } from './services/user.service';
import { TrackService } from './services/track.service';
import { PlaylistService } from './services/playlist.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'XOMCLOUD';

  @ViewChild('introHost', { read: ViewContainerRef, static: true }) private introHost!: ViewContainerRef;

  // Set by the head script in index.html, which also paints the intro's first frame.
  readonly introPlaying = signal(document.documentElement.dataset['intro'] === 'play');

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private trackService: TrackService,
    private playlistService: PlaylistService
  ) {}

  ngOnInit(): void {
    if (!this.introPlaying()) return;
    // Its own chunk, so nobody past the home page downloads it. A failed download goes straight to the page.
    import('./components/intro/intro.component').then(
      ({ IntroComponent }) => {
        const ref = this.introHost.createComponent(IntroComponent);
        ref.instance.done.subscribe(() => {
          ref.destroy();
          this.endIntro();
        });
      },
      () => this.endIntro()
    );
  }

  ngOnDestroy(): void {
    // Clear all cached data on destroy
    this.userService.clearUserCache();
    this.trackService.clearCache();
    this.playlistService.clearCache();
  }

  private endIntro(): void {
    document.documentElement.removeAttribute('data-intro');
    this.introPlaying.set(false);
  }
}
