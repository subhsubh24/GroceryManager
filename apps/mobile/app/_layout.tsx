import { Stack } from "expo-router";
import { configureApi } from "./lib/api";

// Set EXPO_PUBLIC_API_URL to your web app URL (e.g. http://192.168.x.x:3000 in dev, or the prod URL).
// The app will throw on every API call if this is not set — intentional so misconfiguration is obvious.
const _envUrl =
  typeof process !== "undefined"
    ? (process.env as Record<string, string | undefined>)["EXPO_PUBLIC_API_URL"]
    : undefined;
const API_BASE: string = _envUrl ?? "";
configureApi(API_BASE);

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="signin" options={{ title: "Sign in", headerShown: false }} />
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
