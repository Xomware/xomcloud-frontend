// toast.service.ts - Notification service using Observable pattern
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Toast {
  message: string;
  type: 'positive' | 'negative' | 'info';
  duration: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toast$ = new BehaviorSubject<Toast | null>(null);

  getToast$(): Observable<Toast | null> {
    return this.toast$.asObservable();
  }

  showPositiveToast(message: string, duration: number = 3000): void {
    this.showToast(message, 'positive', duration);
  }

  showNegativeToast(message: string, duration: number = 4000): void {
    this.showToast(message, 'negative', duration);
  }

  showInfoToast(message: string, duration: number = 3000): void {
    this.showToast(message, 'info', duration);
  }

  private showToast(message: string, type: 'positive' | 'negative' | 'info', duration: number): void {
    const toast: Toast = { message, type, duration };
    this.toast$.next(toast);

    setTimeout(() => {
      this.toast$.next(null);
    }, duration);
  }
}
