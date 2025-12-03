// OAuth Token Response Model
export interface AuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

// PKCE Challenge Model
export interface PKCEChallenge {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
}
