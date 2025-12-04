// following.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { User } from '../../models';
import { UserService, ToastService } from '../../services';

@Component({
  selector: 'app-following',
  templateUrl: './following.component.html',
  styleUrls: ['./following.component.scss'],
})
export class FollowingComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  userId: number | null = null;
  username: string = '';
  following: User[] = [];
  loading = true;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        this.userId = params['id'] ? +params['id'] : null;
        this.username = params['username'] || 'User';
        this.loadFollowing();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadFollowing(): void {
    if (!this.userId) {
      this.error = 'No user specified';
      this.loading = false;
      return;
    }

    this.loading = true;
    this.error = null;

    this.userService
      .getFollowings(this.userId, 200)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false))
      )
      .subscribe({
        next: (following) => {
          this.following = following;
        },
        error: (err) => {
          console.error('Failed to load following:', err);
          this.error = 'Failed to load following. Please try again.';
          this.toastService.showNegativeToast('Failed to load following');
        },
      });
  }

  goToProfile(user: User): void {
    this.router.navigate(['/user-profile'], {
      queryParams: { id: user.id, username: user.username },
    });
  }

  getAvatarUrl(user: User): string {
    if (!user?.avatar_url) return 'assets/img/default-avatar.png';
    return user.avatar_url.replace('large', 't200x200');
  }

  formatNumber(num: number): string {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  onImageError(event: Event, fallbackSrc: string): void {
    const target = event.target as HTMLImageElement;
    if (target) target.src = fallbackSrc;
  }
}
