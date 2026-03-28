# Architecture — xomcloud-frontend

> Reference with @docs/architecture.md when relevant.
> Not loaded every session — only when needed.

## Overview
Angular 18 single-page application that provides the user interface for the XOMCLOUD platform. Users can browse, search, and download SoundCloud tracks through this frontend, which communicates with the xomcloud-backend API Gateway for all server-side operations. Hosted as a static site on S3 behind CloudFront.

## Key Design Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Angular over React/Vue | Established project choice, strong TypeScript integration, opinionated structure | - |
| S3 + CloudFront hosting | Cost-effective static hosting with CDN, HTTPS, and custom domain support | - |
| RxJS for state/async | Angular-native reactive programming, well-suited for API call chains | - |
| Karma + Jasmine for tests | Angular CLI default, good integration with Angular testing utilities | - |

## Data Flow
1. User interacts with Angular components (search, browse, download)
2. Services make HTTP calls to xomcloud-backend API Gateway
3. JWT token is included in request headers for authentication
4. API responses update component state via RxJS observables
5. Downloaded track info is displayed in the library UI

## External Dependencies
| Service | Purpose | Docs |
|---------|---------|------|
| xomcloud-backend API | Track downloading, auth, metadata | Internal API Gateway |
| AWS S3 | Static site hosting | https://docs.aws.amazon.com/s3/ |
| AWS CloudFront | CDN + HTTPS | https://docs.aws.amazon.com/cloudfront/ |

## Known Limitations / TODOs
- [ ] Evaluate migration to standalone components (Angular 18 feature)
