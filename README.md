# mobile-app1

React Native mobile app and Express/PostgreSQL API in one npm-workspaces monorepo.

## Requirements

- Node.js 20+
- PostgreSQL 16+
- Expo Go on a device, or an Android/iOS simulator

## Setup

```powershell
npm install
Copy-Item apps/api/.env.example apps/api/.env
npm run db:generate --workspace apps/api
npm run db:migrate --workspace apps/api -- --name init
```

Run the API and mobile app in separate terminals:

```powershell
npm run dev
npm run dev:mobile
```

Check types and run the tests:

```powershell
npm run typecheck   # API and mobile
npm test            # mobile unit tests (Jest + jest-expo)
npm run test:watch --workspace apps/mobile
```

Tests live next to the code in `__tests__` folders. They cover the scheduling logic (`src/domain`), storage and notification services (`src/services`), and the `usePlannerData` hook.

The API health endpoint is available at `http://localhost:3000/health`.

For a physical device, use the computer's LAN IP instead of `localhost` when configuring the mobile API client.

## Workspaces

- `apps/mobile`: Expo React Native TypeScript app
- `apps/api`: Express TypeScript API, Prisma ORM, and PostgreSQL schema
