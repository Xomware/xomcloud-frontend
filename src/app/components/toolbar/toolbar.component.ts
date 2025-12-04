// toolbar.component.ts
import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { DownloadQueueService } from '../../services/download-queue.service';

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  dropdownVisible = false;
  isMobile = false;
  queueCount = 0;
  isHiddenPage = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private queueService: DownloadQueueService
  ) {
    this.checkIfMobile();
  }

  ngOnInit(): void {
    window.addEventListener('resize', this.checkIfMobile.bind(this));
    
    // Check initial route
    this.checkHiddenPage();
    
    // Listen for route changes
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.checkHiddenPage();
      this.dropdownVisible = false;
    });

    // Subscribe to queue count
    this.queueService.getQueue$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(queue => {
        this.queueCount = queue.length;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private checkHiddenPage(): void {
    const url = this.router.url;
    // Hide toolbar on home page (login) and callback
    this.isHiddenPage = url === '/home' || url === '/' || url.includes('callback');
  }

  toggleDropdown(): void {
    this.dropdownVisible = !this.dropdownVisible;
  }

  selectItem(route: string): void {
    this.dropdownVisible = false;
    this.router.navigate([route]);
  }

  @HostListener('document:click', ['$event'])
  closeDropdown(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown') && !target.closest('.dropdown-button')) {
      this.dropdownVisible = false;
    }
  }

  checkIfMobile(): void {
    this.isMobile = window.innerWidth <= 768;
  }

  isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  isSelected(route: string): boolean {
    return this.router.url === route || this.router.url.startsWith(route + '?');
  }

  logout(): void {
    this.authService.logout();
  }

  onLogoError(event: Event): void {
    // If logo image fails to load, hide it (text fallback could be shown via CSS)
    const img = event.target as HTMLImageElement;
    if (img) {
      img.style.display = 'none';
    }
  }
}
