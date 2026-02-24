# Xomcloud

Your SoundCloud experience, elevated.

**Live:** https://xomcloud.xomware.com

## Xomware Ecosystem

| App | URL | Frontend | Backend | Infrastructure |
|-----|-----|----------|---------|----------------|
| **Xomware** (Hub) | [xomware.com](https://xomware.com) | [xomware-frontend](https://github.com/Xomware/xomware-frontend) | - | [xomware-infrastructure](https://github.com/Xomware/xomware-infrastructure) |
| **Xomify** | [xomify.xomware.com](https://xomify.xomware.com) | [xomify-frontend](https://github.com/Xomware/xomify-frontend) | [xomify-backend](https://github.com/Xomware/xomify-backend) | [xomify-infrastructure](https://github.com/Xomware/xomify-infrastructure) |
| **Xomcloud** | [xomcloud.xomware.com](https://xomcloud.xomware.com) | [xomcloud-frontend](https://github.com/Xomware/xomcloud-frontend) | [xomcloud-backend](https://github.com/Xomware/xomcloud-backend) | [xomcloud-infrastructure](https://github.com/Xomware/xomcloud-infrastructure) |
| **Xomper** | [xomper.xomware.com](https://xomper.xomware.com) | [xomper-front-end](https://github.com/Xomware/xomper-front-end) | [xomper-back-end](https://github.com/Xomware/xomper-back-end) | [xomper-infrastructure](https://github.com/Xomware/xomper-infrastructure) |

## Tech Stack

- **Frontend:** Angular 18, RxJS, SCSS
- **Auth:** SoundCloud OAuth 2.1 with PKCE
- **API:** SoundCloud API v2
- **Backend:** AWS Lambda (Python), API Gateway (track downloads via S3 presigned URLs)
- **Hosting:** S3 + CloudFront
- **CI/CD:** GitHub Actions (auto-deploy on push to `master`)
- **IaC:** Terraform Cloud

## Features

- **OAuth 2.1 with PKCE** — Secure SoundCloud login; tokens stored locally with automatic refresh
- **My Profile** — View your SoundCloud stats, avatar, followers, and followings
- **Liked Tracks** — Browse your full liked tracks library with audio preview and per-track download
- **Playlists** — View and browse all your playlists and individual playlist contents
- **User Discovery** — Browse any user's profile, tracks, and playlists
- **Followers / Following** — Full follower and following lists with profile links
- **Search** — Discover tracks and artists across SoundCloud
- **Audio Preview** — In-browser streaming preview with play/pause and progress tracking
- **My Crate** — Download queue: select up to 5 tracks, download as a zip via Lambda + S3
- **Toast Notifications** — Inline feedback for actions throughout the app
- **Responsive Design** — Optimized for desktop and mobile

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- A SoundCloud developer account with an app registered at [soundcloud.com/you/apps](https://soundcloud.com/you/apps)

### Setup

1. **Clone the repo**

   ```bash
   git clone https://github.com/Xomware/xomcloud-frontend.git
   cd xomcloud-frontend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment**

   Copy the example and fill in your values:

   ```bash
   cp src/environments/environment.example.ts src/environments/environment.ts
   ```

   ```typescript
   export const environment = {
     production: false,
     soundcloudClientId: 'YOUR_CLIENT_ID',
     soundcloudClientSecret: 'YOUR_CLIENT_SECRET',
     apiAuthToken: 'YOUR_API_TOKEN',
     apiId: 'YOUR_API_GATEWAY_ID',
     baseCallbackUrl: 'http://localhost:4200',
     apiBaseUrl: 'https://api.soundcloud.com',
     authBaseUrl: 'https://secure.soundcloud.com',
   };
   ```

4. **Register your redirect URI**

   In the SoundCloud developer portal, add `http://localhost:4200/callback` as an allowed redirect URI.

5. **Run**

   ```bash
   npm start
   ```

   Navigate to `http://localhost:4200`.

## Authentication Flow

PKCE (Proof Key for Code Exchange) flow:

1. User clicks "Connect with SoundCloud"
2. App generates PKCE code verifier + challenge
3. User is redirected to SoundCloud for authorization
4. Callback route exchanges auth code + verifier for access token
5. Token stored locally; HTTP interceptor attaches it to every API request
6. Automatic token refresh on expiration

## Download Feature (My Crate)

Track downloads are handled by an AWS Lambda backend:

1. User adds tracks to My Crate (max 5)
2. App POSTs track metadata to the Lambda Function URL
3. Lambda downloads audio from SoundCloud, zips the files, and uploads to S3
4. Lambda returns a presigned S3 URL; browser opens it to download the zip
5. Animated progress bar tracks estimated download time based on track durations

## Deployment

Pushes to `master` trigger the GitHub Actions CI/CD pipeline which:

1. Pulls secrets from AWS SSM Parameter Store
2. Injects them into `environment.prod.ts` via `sed`
3. Builds the Angular app in production mode
4. Syncs build output to the S3 bucket behind CloudFront

Manual deploys can be triggered via `workflow_dispatch`.

## Project Structure

```
src/app/
  components/       # Shared UI (toolbar, footer, loader, toast, callback)
  pages/            # Route-level pages
    home/               # Landing / login
    my-profile/         # Authenticated user profile
    liked-tracks/       # User's liked tracks
    playlists/          # User's playlist library
    playlist-detail/    # Single playlist view
    my-crate/           # Download queue (up to 5 tracks → zip)
    search/             # Search tracks and artists
    user-profile/       # Browse any SoundCloud user
    user-tracks/        # A user's public tracks
    user-playlists/     # A user's public playlists
    followers/          # Follower list
    following/          # Following list
  services/         # Angular services
    auth.service.ts         # OAuth 2.1 PKCE flow, token management
    user.service.ts         # Profile data
    track.service.ts        # Liked tracks, search, streaming
    playlist.service.ts     # Playlist CRUD and browsing
    audio-preview.service.ts # In-browser audio preview with progress
    download.service.ts     # Lambda-backed track downloads
    download-queue.service.ts # My Crate queue state
    toast.service.ts        # Notifications
  models/           # TypeScript interfaces (Track, Playlist, User, Auth)
  guards/           # Route guards (auth)
  interceptors/     # HTTP interceptor (auth token injection)
```
