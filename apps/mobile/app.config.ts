import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Dynamic Expo config. The loop-owned static identity (name, bundle ids, icons, splash,
 * permission strings, new-architecture flag) lives in app.json and is committed + REAL;
 * this file EXTENDS it (`config` is app.json's contents) with only the deploy-time values
 * that vary per environment — so nothing is a hardcoded `OWNER_*` placeholder:
 *
 *   EXPO_PUBLIC_PROJECT_ID  → EAS project id (Human Core: `eas init` writes the real value;
 *                             the same var also activates push tokens in lib/notifications.ts)
 *   APP_VERSION             → marketing version (falls back to app.json's version)
 *   IOS_BUILD_NUMBER        → iOS CFBundleVersion (falls back to app.json)
 *   ANDROID_VERSION_CODE    → Android versionCode (falls back to app.json)
 *
 * Validate without a cloud build: `cd apps/mobile && npx expo config --type public`.
 */
const projectId = process.env.EXPO_PUBLIC_PROJECT_ID ?? process.env.EAS_PROJECT_ID;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  // ExpoConfig requires name + slug; source them from app.json with a safe fallback.
  name: config.name ?? "GroceryManager",
  slug: config.slug ?? "grocerymanager",
  version: process.env.APP_VERSION ?? config.version,
  ios: {
    ...config.ios,
    buildNumber: process.env.IOS_BUILD_NUMBER ?? config.ios?.buildNumber,
  },
  android: {
    ...config.android,
    versionCode: process.env.ANDROID_VERSION_CODE
      ? Number(process.env.ANDROID_VERSION_CODE)
      : config.android?.versionCode,
  },
  // EAS project id is read from env — never a committed placeholder. `eas build` also
  // resolves it from the EAS account; left undefined until the owner runs `eas init`.
  extra: {
    ...config.extra,
    eas: projectId ? { ...config.extra?.eas, projectId } : config.extra?.eas,
  },
});
