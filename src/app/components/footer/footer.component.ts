// footer.component.ts
import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent implements OnInit {
  showDynamicButton = false;
  footerButtonText = '';
  githubRepoUrl = 'https://github.com/domgiordano/xomcloud';
  currentRoute = '';

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.currentRoute = event.urlAfterRedirects;
      this.updateDynamicButton();
    });
  }

  private updateDynamicButton(): void {
    if (this.currentRoute.includes('/liked-tracks')) {
      this.showDynamicButton = true;
      this.footerButtonText = 'Create Playlist';
    } else if (this.currentRoute.includes('/search')) {
      this.showDynamicButton = false;
    } else {
      this.showDynamicButton = false;
    }
  }

  handleDynamicButtonClick(): void {
    if (this.currentRoute.includes('/liked-tracks')) {
      // Navigate to create playlist or emit event
      console.log('Create playlist from liked tracks');
    }
  }

  openGitHubRepo(): void {
    window.open(this.githubRepoUrl, '_blank');
  }
}
