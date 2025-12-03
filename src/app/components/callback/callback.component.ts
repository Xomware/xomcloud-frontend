// callback.component.ts
import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-callback',
  template: `
    <app-loader [loading]="true" message="Authenticating with SoundCloud..."></app-loader>
  `,
  styles: []
})
export class CallbackComponent implements OnInit {
  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.authService.handleCallback();
  }
}
