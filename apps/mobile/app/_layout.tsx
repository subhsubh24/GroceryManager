import { Stack } from "expo-router";
import { AuthProvider } from "../lib/auth";

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#13a14a" }, // brand-500, shared with the web theme
          headerTintColor: "#ffffff",
          headerTitleStyle: { fontWeight: "600" },
        }}
      />
    </AuthProvider>
  );
}
