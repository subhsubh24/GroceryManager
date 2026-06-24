import { Stack } from "expo-router";
import { configureApi } from "./lib/api";

// Point at your deployed web app URL. In dev: ngrok or local IP.
// IMPORTANT: Replace with actual URL before shipping.
const _envUrl =
  typeof process !== "undefined"
    ? (process.env as Record<string, string | undefined>)["EXPO_PUBLIC_API_URL"]
    : undefined;
const API_BASE: string = _envUrl ?? "https://grocerymanager.vercel.app";
configureApi(API_BASE);

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="signin" options={{ title: "Sign in", headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
