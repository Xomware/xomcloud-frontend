// footer.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
})
export class FooterComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  showDynamicButton = false;
  footerButtonText = '';
  githubRepoUrl = 'https://github.com/domgiordano/xomcloud-frontend';
  currentRoute = '';

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: NavigationEnd) => {
        this.currentRoute = event.urlAfterRedirects;
        this.updateDynamicButton();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateDynamicButton(): void {
    if (this.currentRoute.includes('/liked-tracks')) {
      this.showDynamicButton = true;
      this.footerButtonText = 'Create Playlist';
    } else {
      this.showDynamicButton = false;
    }
  }

  handleDynamicButtonClick(): void {
    // Placeholder for future playlist creation feature
  }

  openGitHubRepo(): void {
    window.open(this.githubRepoUrl, '_blank');
  }
}
