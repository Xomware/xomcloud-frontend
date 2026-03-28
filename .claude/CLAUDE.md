# xomcloud-frontend

> Angular frontend for XOMCLOUD — SoundCloud music library interface.

## What This Is
Angular SPA for managing a personal SoundCloud music library. Browse, search, and play downloaded tracks. Hosted on S3 + CloudFront.

## Stack
- Angular 18, TypeScript, RxJS
- Karma + Jasmine (testing)

## Key Commands
```bash
npm start           # dev server (ng serve)
npm run build:prod  # production build
npm test            # unit tests
npm run lint        # linting
```

## Important Paths
```
src/app/
  components/    # UI components
  pages/         # route-level pages
  services/      # API clients
```

## Project Config
```yaml
pm_tool: none
base_branch: master
test_commands:
  - npm test
build_commands:
  - npm run build:prod
```

## Constraints
- Auto-deploys on push to master via GitHub Actions -> S3 + CloudFront
- API calls go to xomcloud-backend via API Gateway

## Lessons
