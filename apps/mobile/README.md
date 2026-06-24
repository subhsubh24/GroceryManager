# @gm/mobile — GroceryManager native app (Expo)

> **Status: typecheckable skeleton.** The directory has real Expo 56 deps and a working `typecheck`
> script. Run the dev app with `cd apps/mobile && npm install && npx expo start`. Full feature parity
> with `apps/web` is the goal (see ROADMAP Track B) — the screens below are placeholders.

## Architecture

All business logic lives in framework-agnostic `packages/core` — the web app is one consumer; this
native app is a second. See `app/index.tsx`, which imports `scaleMeasure` from `@gm/core/recipe`
(the same helper the web Cook Mode uses) to prove the engines are directly reusable in native without
any reimplementation.

`@gm/core/*` resolves via tsconfig path aliases (`../../packages/core/src/*`) so no pnpm workspace
link is needed — the mobile app remains excluded from the root `pnpm-workspace.yaml`.

## Getting started

```bash
cd apps/mobile
npm install                  # install Expo 56 deps (once)
npm run typecheck            # tsc --noEmit
npx expo start               # start Metro bundler
```

## Layout

- `app/_layout.tsx` — expo-router root stack (brand-themed header).
- `app/index.tsx` — Home screen; demonstrates `@gm/core` reuse via `scaleMeasure`.
- `app/pantry.tsx` — Placeholder pantry screen (wire to the API + `packages/core/pantry`).
- `app.json` — Expo config (SDK 56, typed routes, portrait).
- `tsconfig.json` — extends `expo/tsconfig.base`, strict, with `@gm/core/*` path alias.
- `babel.config.js` — standard `babel-preset-expo` config.
