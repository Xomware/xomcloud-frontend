// toast.service.ts - Notification service
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
  private toastComponent: any = null;

  getToast$(): Observable<Toast | null> {
    return this.toast$.asObservable();
  }

  registerToast(component: any): void {
    this.toastComponent = component;
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

    if (this.toastComponent) {
      this.toastComponent.toastType = type;
      this.toastComponent.showToast(message);
    }

    // Auto-clear after duration
    setTimeout(() => {
      this.toast$.next(null);
    }, duration);
  }
}
