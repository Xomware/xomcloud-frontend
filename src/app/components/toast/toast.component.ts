// toast.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Toast, ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-toast',
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.scss'],
  animations: [
    trigger('slideIn', [
      state('void', style({
        transform: 'translateY(100%)',
        opacity: 0
      })),
      transition(':enter', [
        animate('300ms ease-out', style({
          transform: 'translateY(0)',
          opacity: 1
        }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({
          transform: 'translateY(100%)',
          opacity: 0
        }))
      ]),
    ]),
  ],
})
export class ToastComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  toastType: 'positive' | 'negative' | 'info' = 'positive';
  message = '';
  isVisible = false;

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    this.toastService.getToast$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((toast: Toast | null) => {
        if (toast) {
          this.toastType = toast.type;
          this.message = toast.message;
          this.isVisible = true;
        } else {
          this.isVisible = false;
          this.message = '';
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
