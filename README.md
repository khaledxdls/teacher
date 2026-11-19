# ClassPilot

A planner for teachers: a weekly (Friday–Thursday) schedule, classes with student lists, attendance, reusable week templates and reminders. Data lives on the phone and, after signing in, is backed up and synced across devices.

npm-workspaces monorepo:

- `apps/mobile`: Expo SDK 58 / React Native app (Expo Router, TypeScript)
- `apps/api`: Express 5 API with Prisma and PostgreSQL (accounts and sync)

## Requirements

- Node.js 20+
- PostgreSQL 14+ (for running the API; the API tests start their own throwaway database)
- Expo Go on a device, or an Android/iOS simulator

## Setup

```powershell
npm install
Copy-Item apps/api/.env.example apps/api/.env        # then set DATABASE_URL and JWT_SECRET
Copy-Item apps/mobile/.env.example apps/mobile/.env  # set EXPO_PUBLIC_API_URL
npm run db:deploy --workspace apps/api               # create the tables
```

Run the API and the app in separate terminals:

```powershell
npm run dev          # API on http://localhost:3000 (health: /health)
npm run dev:mobile   # Expo dev server
```

On a physical phone, `localhost` is the phone itself: set `EXPO_PUBLIC_API_URL` to your computer's LAN IP (for example `http://192.168.1.20:3000`) and restart Expo.

## Checks

```powershell
npm run check        # typecheck + lint + all tests
npm run test:api     # API integration tests (real PostgreSQL via embedded-postgres)
npm run test:mobile  # app unit tests (Jest + jest-expo)
```

## How the app is organised

```
apps/mobile/src/
  app/                 Expo Router routes: (tabs)/ Schedule, Classes, Templates, Account; class/[id]
  features/            screens and their components
  state/               PlannerProvider (all planner data) and SyncProvider (account + sync)
  domain/              pure logic: schedule, attendance, templates, v1 → v2 migration, sync merge
  services/            AsyncStorage, notifications, API client, secure session storage
```

## Sync design

- Every record (lesson, class, template) carries `updatedAt`, a `deleted` tombstone flag and a local-only `dirty` flag.
- `POST /sync` sends dirty records and receives everything changed since the client's cursor. The server keeps the newest `updatedAt` per record (last write wins).
- The server serializes writes per user with a `syncVersion` counter, so concurrent devices never miss each other's changes.
- Signing in uploads everything already on the phone, so nothing is lost when an existing user creates an account.
- Data stays on the device after signing out.

Known limits: a class's student list syncs as a whole, so two devices editing the same class's students at the same moment keep only the newer edit. Tombstones are kept indefinitely.

## API

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/register` | `{ email, password, name? }` → `{ token, user }` |
| `POST` | `/auth/login` | `{ email, password }` → `{ token, user }` |
| `GET` | `/auth/me` | current user (Bearer token) |
| `POST` | `/sync` | `{ cursor, changes[] }` → `{ cursor, changes[] }` (Bearer token, max 500 changes) |
| `GET` | `/health` | API and database status |
