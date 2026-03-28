// Environment configuration
// CI/CD replaces '---' placeholders via sed before production build
// For local dev: copy to environment.local.ts with real values (gitignored)
//
// NOTE: soundcloudClientSecret has been removed from the frontend.
// Token exchange must happen via a backend endpoint.
// See: https://github.com/Xomware/xomcloud-frontend/issues/22
export const environment = {
  production: false,
  soundcloudClientId: '---',
  apiAuthToken: '---',
  apiId: '---',
  baseCallbackUrl: 'http://localhost:4200',
  apiBaseUrl: 'https://api.soundcloud.com',
  authBaseUrl: 'https://secure.soundcloud.com',
  get xomcloudApiUrl(): string {
    return this.apiId === '---'
      ? ''
      : `https://${this.apiId}.execute-api.us-east-1.amazonaws.com/dev`;
  },
  get downloadApiUrl(): string {
    return this.apiId === '---'
      ? ''
      : `https://${this.apiId}.execute-api.us-east-1.amazonaws.com/dev/download`;
  },
  get tokenExchangeUrl(): string {
    return this.apiId === '---'
      ? ''
      : `https://${this.apiId}.execute-api.us-east-1.amazonaws.com/dev/auth/token`;
  }
};
