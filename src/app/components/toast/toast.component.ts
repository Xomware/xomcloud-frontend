// toast.component.ts
import { Component, OnInit } from '@angular/core';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { ToastService } from 'src/app/services/toast.service';

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
export class ToastComponent implements OnInit {
  toastType: 'positive' | 'negative' | 'info' = 'positive';
  message = '';
  isVisible = false;

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    this.toastService.registerToast(this);
  }

  showToast(msg: string): void {
    this.message = msg;
    this.isVisible = true;

    setTimeout(() => {
      this.isVisible = false;
      this.message = '';
    }, 3500);
  }
}
