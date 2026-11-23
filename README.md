# ClassPilot

A planner for teachers: a Friday–Thursday schedule with repeating lessons, a Today view, and a page per lesson with attendance, lesson plan (objectives, links, homework), homework tracking, participation/behaviour notes and after-class notes. Classes and students, a gradebook, class insights (attendance and grade trends, students who need attention), exportable attendance reports, week templates, a school calendar (terms, holidays, Week A/B), calendar export (.ics), file backup/restore and reminders. A short welcome tour sets up the first class. Works offline (SQLite on the phone); signing in backs everything up and syncs it across devices. English, French and Arabic (right-to-left), light and dark mode.

npm-workspaces monorepo:

- `apps/mobile`: Expo SDK 58 / React Native app (Expo Router, TypeScript)
- `apps/api`: Express 5 API with Prisma and PostgreSQL (accounts, password reset, sync, error intake)

## Requirements

- Node.js 20.11+
- PostgreSQL 14+ (to run the API; the API tests start their own throwaway database)
- Expo Go on a device, or an Android/iOS simulator

## Setup

```powershell
npm install
Copy-Item apps/api/.env.example apps/api/.env        # set DATABASE_URL and JWT_SECRET
Copy-Item apps/mobile/.env.example apps/mobile/.env  # set EXPO_PUBLIC_API_URL
npm run db:deploy --workspace apps/api               # create the tables
```

Run the API and the app in separate terminals:

```powershell
npm run dev          # API on http://localhost:3000 (health: /health)
npm run dev:mobile   # Expo dev server
```

On a physical phone, `localhost` is the phone itself: set `EXPO_PUBLIC_API_URL` to your computer's LAN IP (for example `http://192.168.1.20:3000`) and restart Expo. Without `RESEND_API_KEY`, password-reset emails (with the code) are printed in the API terminal.

## Checks

```powershell
npm run check        # typecheck + lint + all tests (what CI runs)
npm run test:api     # API integration tests (real PostgreSQL via embedded-postgres)
npm run test:mobile  # app tests (Jest + jest-expo + Testing Library)
```

## Architecture

```
apps/mobile/src/
  app/            Expo Router routes (thin files that re-export screens)
  features/       screens by feature: today, schedule, classes, grades, reports, followUps,
                  templates, calendar, settings, reminders
  components/ui/  reusable themed building blocks (Button, Card, ListRow, TextField,
                  SegmentedControl, DateTimeInput, FormModal, PromptModal, …)
  domain/         pure TypeScript, no React: types, dates, schedule, recurrence, calendar,
                  attendance, grades, reports (CSV/HTML), migrations, sync merge
  domain/commands/  every data change as a pure function: (state, input, context) → Result
  state/          external store + PlannerProvider (binds commands), SyncProvider, preferences
  i18n/           typed dictionaries (en is the source; fr/ar must match its shape), plural rules
  theme/          light/dark palettes, ThemeProvider, createStyles()
  services/       repository (SQLite on native, AsyncStorage on web), notifications, API client,
                  export/share/import, error reporting
```

Key ideas:

- **Commands are pure.** `domain/commands` validate input and return either the next state or an error code (`{ ok: false, error: { code } }`). The UI translates codes with `tError`. They are unit-tested without React.
- **One store, small subscriptions.** `state/store.ts` keeps planner data outside React so actions always see the latest state; hooks such as `useLessons()` subscribe to one slice each.
- **Themed styles.** `createStyles((c) => ({ … }))` declares styles once per palette; components never use raw colours.
- **Typed translations.** `t('schedule.addLesson')` keys are checked at compile time; a test checks French and Arabic use only placeholders English defines.

## Sync design

- Every record carries `updatedAt`, a `deleted` tombstone flag and a local-only `dirty` flag. Collections: lessons, classes, students, templates, assessments, scores, attendance marks, homework marks, behaviour notes, calendar events, settings.
- Anything two devices might edit independently is its own record. Per-student marks use deterministic ids (`lessonId:studentId`, `assessmentId:studentId`), so two devices marking the same student converge on one record.
- Older data that embedded students/scores/attendance in their parent record is upgraded on load and on every sync (`upgradeEmbeddedRecords`).
- `POST /sync` sends dirty records and receives everything changed since the client's cursor; the server keeps the newest `updatedAt` per record (last write wins) and serializes writes per user.
- Signing in uploads what is already on the phone. Signing out keeps the data on the phone.
- Changing or resetting the password signs out other devices (token version check).

Known limits: each record is last-write-wins as a whole (two devices editing the same lesson's plan at the same moment keep the newer one). Tombstones are kept indefinitely. Lesson "attachments" are links (e.g. to a drive); files are not uploaded.

## API

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/register` | `{ email, password, name? }` → `{ token, user }` |
| `POST` | `/auth/login` | `{ email, password }` → `{ token, user }` |
| `GET` | `/auth/me` | current user |
| `POST` | `/auth/password` | `{ currentPassword, newPassword }` → new session; other devices signed out |
| `POST` | `/auth/password/forgot` | `{ email }` → emails a 6-digit code (always 202) |
| `POST` | `/auth/password/reset` | `{ email, code, newPassword }` → new session |
| `DELETE` | `/auth/me` | `{ password }` → deletes the account and all synced data |
| `POST` | `/sync` | `{ cursor, changes[] }` → `{ cursor, changes[] }` (max 500 changes) |
| `POST` | `/client-errors` | error reports from the app, forwarded to Sentry |
| `GET` | `/health` | API and database status |

Authenticated routes take `Authorization: Bearer <token>`.

## Icons

`apps/mobile/scripts/generate-icons.cjs` renders the app icon, Android adaptive/monochrome icons, splash image and favicon from SVG:

```powershell
cd apps/mobile
npm i --no-save @resvg/resvg-js@2
node scripts/generate-icons.cjs assets
```

## Deployment

**API.** `apps/api/Dockerfile` builds a production image (run from the repo root); it applies migrations on start. `render.yaml` is a Render Blueprint that creates the service and a PostgreSQL database and generates `JWT_SECRET`. Set `RESEND_API_KEY` and `MAIL_FROM` for real password-reset emails and `SENTRY_DSN` for monitoring (it also receives the app's error reports).

**App.** `apps/mobile/eas.json` defines `preview` (installable APK / ad-hoc build for testers) and `production` profiles; both point `EXPO_PUBLIC_API_URL` at the deployed API (`https://classpilot-api-9bm3.onrender.com`). Build with:

```powershell
cd apps/mobile
npx eas-cli@latest build --profile preview --platform android
```

**CI.** `.github/workflows/ci.yml` runs `npm run check` and builds the API on every push to `main` and on pull requests.
