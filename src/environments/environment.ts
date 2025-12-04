// Environment configuration
// CI/CD replaces '---' placeholders via sed before production build
// For local dev: copy to environment.local.ts with real values (gitignored)
export const environment = {
  production: false,
  soundcloudClientId: '---',
  soundcloudClientSecret: '---',
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
};
