// app.component.ts
import { Component, OnDestroy } from '@angular/core';
import { AuthService } from './services/auth.service';
import { UserService } from './services/user.service';
import { TrackService } from './services/track.service';
import { PlaylistService } from './services/playlist.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnDestroy {
  title = 'XOMCLOUD';

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private trackService: TrackService,
    private playlistService: PlaylistService
  ) {}

  ngOnDestroy(): void {
    // Clear all cached data on destroy
    this.userService.clearUserCache();
    this.trackService.clearCache();
    this.playlistService.clearCache();
  }
}
