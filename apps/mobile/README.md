# @gm/mobile — GroceryManager native app (Expo)

> **Status: feature-complete native app** (ROADMAP Track B, 2026-06-24). 18 real screens built on
> React Native primitives — no WebView wrapper — talking to the web app's `/api/mobile/*` endpoints
> and reusing the framework-agnostic engines in `packages/core`. Ready for an EAS build + store
> submission (see `docs/LAUNCH.md`). Run it locally with `cd apps/mobile && npm install && npx expo start`.

## Architecture

All business logic lives in framework-agnostic `packages/core` — the web app is one consumer; this
native app is a second. `@gm/core/*` resolves via tsconfig path aliases (`../../packages/core/src/*`)
so no pnpm workspace link is needed — the mobile app stays excluded from the root
`pnpm-workspace.yaml` and uses plain `npm` (its own lockfile). The CI `mobile` job runs `npm ci` +
`tsc --noEmit`.

Screens are thin native UIs over shared logic: each fetches from the authenticated `/api/mobile/*`
routes (see `lib/api.ts`) using the session token from `lib/auth.tsx`, and formatting/scaling helpers
come straight from `@gm/core` (the same code the web app runs). Navigation is `expo-router` (a
`Stack` in `app/_layout.tsx`); in-app purchases go through `react-native-purchases` (RevenueCat) in
`lib/purchases.ts`.

## Getting started

```bash
cd apps/mobile
npm install                  # install deps (once); mobile has its own lockfile
npm run typecheck            # tsc --noEmit
npx expo start               # start Metro bundler
```

## Layout

- `app/_layout.tsx` — `expo-router` root `Stack` (brand-themed header, auth provider).
- `app/index.tsx` — Home; redirects to `/login` when signed out, else the in-app dashboard.
- `app/login.tsx`, `app/onboarding.tsx` — auth + first-run flow.
- `app/pantry.tsx`, `app/list.tsx`, `app/recipes.tsx` — pantry, shopping list, cookbook.
- `app/cook-tonight.tsx`, `app/cooked.tsx`, `app/discover.tsx`, `app/use-it-up.tsx` — the cook loop.
- `app/plan.tsx`, `app/digest.tsx`, `app/spend.tsx`, `app/wrapped.tsx` — planning, digest, spend, Wrapped.
- `app/capture.tsx` — receipt/photo capture. `app/profile.tsx` — account. `app/upgrade.tsx` — paywall.
- `lib/` — `api.ts` (authenticated fetch), `auth.tsx` (session), `config.ts`, `notifications.ts`,
  `purchases.ts` (RevenueCat IAP).
- `app.json` — Expo config (SDK 56, `expo-router`, portrait). `tsconfig.json` — strict, `@gm/core/*`
  path alias. `babel.config.js` — `babel-preset-expo`.
