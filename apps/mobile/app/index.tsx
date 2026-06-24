import { useEffect, useState } from "react";
import { Link, Redirect } from "expo-router";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";

export default function HomeScreen() {
  const { token, userName, logout } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    apiFetch("/api/mobile/onboarding", token)
      .then((res) => res.json())
      .then((data: { onboarded?: boolean }) => {
        if (!cancelled) setOnboarded(data.onboarded ?? true);
      })
      .catch(() => {
        if (!cancelled) setOnboarded(true); // fail-open: don't block home on check failure
      });
    return () => { cancelled = true; };
  }, [token]);

  if (!token) return <Redirect href="/login" />;
  // While the onboarding check is in-flight (null), render nothing so new users never see
  // the full home screen before being redirected to onboarding.
  if (onboarded === null) return null;
  if (onboarded === false) return <Redirect href="/onboarding" />;

  return (
    <View style={styles.container}>
      <View style={styles.logoMark}>
        <Text style={styles.logoGlyph}>GM</Text>
      </View>
      <Text style={styles.title}>GroceryManager</Text>
      <Text style={styles.subtitle}>
        {userName ? `Welcome back, ${userName}` : "Your grocery + cooking autopilot"}
      </Text>

      <View style={styles.nav}>
        <Link href="/pantry" style={styles.card}>
          <Text style={styles.cardLabel}>Pantry →</Text>
          <Text style={styles.cardNote}>What you have at home</Text>
        </Link>
        <Link href="/list" style={styles.card}>
          <Text style={styles.cardLabel}>Shopping list →</Text>
          <Text style={styles.cardNote}>What to pick up next</Text>
        </Link>
        <Link href="/recipes" style={styles.card}>
          <Text style={styles.cardLabel}>Cookbook →</Text>
          <Text style={styles.cardNote}>Your saved recipes</Text>
        </Link>
        <Link href="/cook-tonight" style={styles.card}>
          <Text style={styles.cardLabel}>Cook tonight →</Text>
          <Text style={styles.cardNote}>Recipes from what you have</Text>
        </Link>
        <Link href="/cooked" style={styles.card}>
          <Text style={styles.cardLabel}>Meals &amp; macros →</Text>
          <Text style={styles.cardNote}>Your cook log with nutrition</Text>
        </Link>
        <Link href="/capture" style={styles.card}>
          <Text style={styles.cardLabel}>Quick add →</Text>
          <Text style={styles.cardNote}>Add items to your list</Text>
        </Link>
        <Link href="/profile" style={styles.card}>
          <Text style={styles.cardLabel}>Profile &amp; settings →</Text>
          <Text style={styles.cardNote}>Account, subscription, delete account</Text>
        </Link>
      </View>

      <Pressable style={styles.signOut} onPress={logout}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#faf8f3",
  },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#0c8a3e",
    alignItems: "center",
    justifyContent: "center",
  },
  logoGlyph: { color: "#ffffff", fontSize: 24, fontWeight: "800" },
  title: { fontSize: 28, fontWeight: "700", color: "#1d2530", marginTop: 12 },
  subtitle: { fontSize: 15, color: "#525d6a", marginTop: 6, textAlign: "center", marginBottom: 32 },
  nav: { width: "100%", gap: 12 },
  card: {
    display: "flex",
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#ece7dd",
    marginBottom: 12,
  },
  cardLabel: { fontSize: 16, fontWeight: "700", color: "#0c8a3e" },
  cardNote: { fontSize: 13, color: "#525d6a", marginTop: 2 },
  signOut: { marginTop: 32 },
  signOutText: { fontSize: 14, color: "#9ba8b4" },
});
