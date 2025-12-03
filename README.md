# XOMCLOUD 🎵

Your SoundCloud Experience, Elevated.

- [FE Rep0](https://github.com/domgiordano/xomcloud-frontend)
- [BE Repo](https://github.com/domgiordano/xomcloud-backend)
- [Infra Repo](https://github.com/domgiordano/xomcloud-infrastructure)
- [Terraform Workspace](https://app.terraform.io/app/Domjgiordano/workspaces/xomcloud-infrastructure)

## Overview

XOMCLOUD is an Angular application that integrates with the SoundCloud API to provide a beautiful, modern interface for managing your SoundCloud account. View your liked tracks, manage playlists, discover new music, and more.

## Features

- 🔐 **OAuth 2.1 with PKCE** - Secure authentication with SoundCloud
- 👤 **Profile Management** - View your stats, followers, and account info
- ❤️ **Liked Tracks** - Browse and manage your liked tracks
- 📋 **Playlists** - Create, edit, and organize playlists
- 🔍 **Search** - Discover new tracks and artists
- 📱 **Responsive Design** - Works beautifully on desktop and mobile

## Tech Stack

- **Frontend**: Angular 17+
- **Styling**: SCSS with custom design system
- **Authentication**: OAuth 2.1 with PKCE
- **API**: SoundCloud API v2
- **State Management**: RxJS BehaviorSubjects

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- SoundCloud Developer Account

### Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/domgiordano/xomcloud.git
   cd xomcloud
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment**

   Edit `src/environments/environment.ts`:

   ```typescript
   export const environment = {
     production: false,
     soundcloudClientId: "YOUR_CLIENT_ID",
     soundcloudClientSecret: "YOUR_CLIENT_SECRET",
     baseCallbackUrl: "http://localhost:4200",
     apiBaseUrl: "https://api.soundcloud.com",
     authBaseUrl: "https://secure.soundcloud.com",
   };
   ```

4. **Register your app on SoundCloud**

   - Go to [SoundCloud Developer Portal](https://soundcloud.com/you/apps)
   - Create a new application
   - Add `http://localhost:4200/callback` as a redirect URI
   - Copy your Client ID and Client Secret

5. **Run the development server**

   ```bash
   npm start
   ```

   Navigate to `http://localhost:4200`

## Project Structure

```
src/
├── app/
│   ├── components/          # Reusable components
│   │   ├── toolbar/
│   │   ├── footer/
│   │   ├── loader/
│   │   ├── toast/
│   │   └── callback/
│   ├── pages/               # Page components
│   │   ├── home/
│   │   └── my-profile/
│   ├── services/            # API and state services
│   │   ├── auth.service.ts
│   │   ├── user.service.ts
│   │   ├── track.service.ts
│   │   ├── playlist.service.ts
│   │   └── toast.service.ts
│   ├── models/              # TypeScript interfaces
│   ├── guards/              # Route guards
│   └── interceptors/        # HTTP interceptors
├── environments/            # Environment configs
└── assets/                  # Static assets
```

## Authentication Flow

XOMCLOUD uses OAuth 2.1 with PKCE (Proof Key for Code Exchange) for secure authentication:

1. User clicks "Connect with SoundCloud"
2. App generates PKCE code verifier and challenge
3. User is redirected to SoundCloud authorization
4. After approval, user returns with authorization code
5. App exchanges code + verifier for access token
6. Token is stored and used for API requests
7. Automatic token refresh handles expiration

## API Integration

All SoundCloud API calls go through dedicated services:

- **AuthService**: OAuth flow, token management
- **UserService**: Profile data, followings/followers
- **TrackService**: Liked tracks, search, streaming
- **PlaylistService**: CRUD operations for playlists

## Design System

Colors:

- Primary: `#ff6b35` (Orange)
- Secondary: `#f7931e` (Light Orange)
- Background: `#0a0a14` - `#1a1a35` (Dark gradient)
- Text: `#ffffff`, `#b0b0c0`, `#8a8a9a`

## Deployment

### Build for Production

```bash
npm run build:prod
```

### Deploy to S3/CloudFront (recommended)

1. Build the production bundle
2. Upload `dist/xomcloud` to S3 bucket
3. Configure CloudFront distribution
4. Update environment with production URLs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - feel free to use this for your own projects!

## Author

Built with 🎵 by [@domgiordano](https://github.com/domgiordano)

---

_Inspired by [XOMIFY](https://xomify.com) - the Spotify version_
