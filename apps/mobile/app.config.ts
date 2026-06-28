import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Dynamic Expo config — the loop-owned identity (bundle ids, icons, splash, permission
 * strings) is committed and REAL; the deploy-time values that vary per environment are read
 * from env so nothing is a hardcoded `OWNER_*` placeholder:
 *
 *   EXPO_PUBLIC_PROJECT_ID  → EAS project id (Human Core: `eas init` writes the real value;
 *                             the same var also activates push tokens in lib/notifications.ts)
 *   APP_VERSION             → marketing version (default 1.0.0)
 *   IOS_BUILD_NUMBER        → iOS CFBundleVersion (default "1")
 *   ANDROID_VERSION_CODE    → Android versionCode (default 1)
 *
 * Validate without a cloud build: `cd apps/mobile && npx expo config --type public`.
 */
const projectId = process.env.EXPO_PUBLIC_PROJECT_ID ?? process.env.EAS_PROJECT_ID;
const version = process.env.APP_VERSION ?? "1.0.0";
const iosBuildNumber = process.env.IOS_BUILD_NUMBER ?? "1";
const androidVersionCode = Number(process.env.ANDROID_VERSION_CODE ?? "1");

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "GroceryManager",
  slug: "grocerymanager",
  scheme: "grocerymanager",
  version,
  icon: "./assets/icon.png",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  splash: {
    image: "./assets/icon.png",
    resizeMode: "contain",
    backgroundColor: "#0c8a3e",
  },
  plugins: ["expo-router"],
  experiments: { typedRoutes: true },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.grocerymanager.app",
    buildNumber: iosBuildNumber,
    infoPlist: {
      NSCameraUsageDescription:
        "GroceryManager uses the camera to scan barcodes and capture fridge photos.",
      NSMicrophoneUsageDescription:
        "GroceryManager uses the microphone for voice quick-add.",
    },
  },
  android: {
    package: "com.grocerymanager.app",
    versionCode: androidVersionCode,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0c8a3e",
    },
    permissions: ["android.permission.CAMERA", "android.permission.RECORD_AUDIO"],
  },
  // EAS project id is read from env — never a committed placeholder. `eas build` also
  // resolves it from the EAS account; left undefined until the owner runs `eas init`.
  extra: {
    eas: projectId ? { projectId } : {},
  },
});
