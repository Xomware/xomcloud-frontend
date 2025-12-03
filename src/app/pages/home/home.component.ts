// home.component.ts
import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  features = [
    {
      icon: '🎵',
      title: 'View Your Likes',
      description: 'Browse all your liked tracks in one beautiful interface'
    },
    {
      icon: '📋',
      title: 'Manage Playlists',
      description: 'Create, edit, and organize your SoundCloud playlists'
    },
    {
      icon: '🔍',
      title: 'Discover Music',
      description: 'Search and explore tracks from millions of artists'
    },
    {
      icon: '📊',
      title: 'Profile Stats',
      description: 'View your listening stats, followers, and more'
    }
  ];

  constructor(private authService: AuthService) {}

  login(): void {
    this.authService.login();
  }
}
