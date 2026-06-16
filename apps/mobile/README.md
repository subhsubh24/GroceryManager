# @gm/mobile — GroceryManager native app (skeleton)

> **Status: non-functional skeleton.** This directory sketches the intended native (Expo) app and
> proves the architecture (UI here, engines reused from `packages/core`). It is **not installed or
> built** by the monorepo — it's deliberately **excluded from the pnpm workspace** (`!apps/mobile` in
> `pnpm-workspace.yaml`) so it can never affect the root `pnpm install --frozen-lockfile` or CI. The
> Expo/React-Native dependencies are intentionally **not** in `package.json`; a developer initializes
> them (below) when picking this up.

## Why this exists
The monorepo was structured from day one so the UI is replaceable but the logic isn't: all business
logic lives in framework-agnostic `packages/core` (ingestion, pantry, reorder, recipe, personalization,
…). The web app (`apps/web`) is one consumer; this is the start of a second (native) consumer that
reuses the exact same engines — see `app/index.tsx`, which imports `scaleMeasure` from
`@gm/core/recipe` (the same helper the web Cook Mode uses).

## Make it real
```bash
# from apps/mobile/
npx create-expo-app@latest . --template tabs   # or wire expo-router into this skeleton
pnpm add expo expo-router react-native react react-dom
pnpm add -D typescript @types/react
# add "@gm/core": "workspace:*" to dependencies and remove the "!apps/mobile" exclusion in
# pnpm-workspace.yaml so the workspace links packages/core, then:
npx expo start
```
Then replace the placeholder screens (`app/index.tsx`, `app/pantry.tsx`) with real ones that call the
GroceryManager API and render `packages/core` outputs natively.

## Layout
- `app/_layout.tsx` — expo-router root stack (brand-themed header).
- `app/index.tsx` — Home; demonstrates `packages/core` reuse.
- `app/pantry.tsx` — placeholder pantry screen.
- `app.json` — Expo config.
