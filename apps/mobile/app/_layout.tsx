// Expo Router root layout. SKELETON: `expo-router`/`react-native` are not installed in this repo
// (see ../README.md) — this package is excluded from the pnpm workspace + typecheck on purpose, so
// these imports are intentionally unresolved until a developer initializes Expo here.
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#13a14a" }, // brand-500, shared with the web theme
        headerTintColor: "#ffffff",
        headerTitleStyle: { fontWeight: "600" },
      }}
    />
  );
}
