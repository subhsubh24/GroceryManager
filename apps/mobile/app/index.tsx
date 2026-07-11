import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { Link, Redirect } from "expo-router";
import type { Href } from "expo-router";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";
import {
  ChevronRight,
  Cookbook,
  CookTonight,
  Discover,
  Meals,
  Pantry,
  PlanWeek,
  Profile,
  QuickAdd,
  ShoppingList,
  Spend,
  Stats,
  UseItUp,
  Wrapped,
  type IconProps,
} from "../lib/icons";

/**
 * The home navigation grid — one source of truth so the icon, label, and blurb stay in lockstep.
 * Each destination gets a real Ionicons vector icon (via `../lib/icons`), mirroring the web PWA's
 * icon-per-section home; no raw "→" glyph does icon duty anymore.
 */
const NAV_ITEMS: { href: Href; Icon: ComponentType<IconProps>; label: string; note: string }[] = [
  { href: "/pantry", Icon: Pantry, label: "Pantry", note: "What you have at home" },
  { href: "/list", Icon: ShoppingList, label: "Shopping list", note: "What to pick up next" },
  { href: "/recipes", Icon: Cookbook, label: "Cookbook", note: "Your saved recipes" },
  { href: "/cook-tonight", Icon: CookTonight, label: "Cook tonight", note: "Recipes from what you have" },
  { href: "/plan", Icon: PlanWeek, label: "Plan my week", note: "AI-powered weekly dinner plan" },
  { href: "/use-it-up", Icon: UseItUp, label: "Use it up", note: "Recipes for items expiring soon" },
  { href: "/discover", Icon: Discover, label: "Discover", note: "For-you feed — like or skip to tune your taste" },
  { href: "/spend", Icon: Spend, label: "Spending", note: "Grocery spend from your receipts" },
  { href: "/cooked", Icon: Meals, label: "Meals & macros", note: "Your cook log with nutrition" },
  { href: "/digest", Icon: Stats, label: "Cooking stats", note: "Streak, weekly activity, totals" },
  { href: "/wrapped", Icon: Wrapped, label: "Grocery Wrapped", note: "Your year in food — meals, savings, top recipes" },
  { href: "/capture", Icon: QuickAdd, label: "Quick add", note: "Add items to your list" },
  { href: "/profile", Icon: Profile, label: "Profile & settings", note: "Account, subscription, delete account" },
];

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
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.logoMark}>
        <Text style={styles.logoGlyph}>GM</Text>
      </View>
      <Text style={styles.title}>GroceryManager</Text>
      <Text style={styles.subtitle}>
        {userName ? `Welcome back, ${userName}` : "Your grocery + cooking autopilot"}
      </Text>

      <View style={styles.nav}>
        {NAV_ITEMS.map(({ href, Icon, label, note }) => (
          <Link key={label} href={href} asChild>
            <Pressable style={styles.card} accessibilityRole="button" accessibilityLabel={label}>
              <View style={styles.cardIcon}>
                <Icon size={22} color="#0c8a3e" />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardLabel}>{label}</Text>
                <Text style={styles.cardNote}>{note}</Text>
              </View>
              <ChevronRight size={20} color="#c8c1b8" />
            </Pressable>
          </Link>
        ))}
      </View>

      <Pressable style={styles.signOut} onPress={logout}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#faf8f3" },
  container: {
    alignItems: "center",
    padding: 24,
    paddingBottom: 40,
  },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#0c8a3e",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  logoGlyph: { color: "#ffffff", fontSize: 24, fontWeight: "800" },
  title: { fontSize: 28, fontWeight: "700", color: "#1d2530", marginTop: 12 },
  subtitle: { fontSize: 15, color: "#525d6a", marginTop: 6, textAlign: "center", marginBottom: 32 },
  nav: { width: "100%", gap: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#ece7dd",
    marginBottom: 12,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#eef6ef",
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1 },
  cardLabel: { fontSize: 16, fontWeight: "700", color: "#0c8a3e" },
  cardNote: { fontSize: 13, color: "#525d6a", marginTop: 2 },
  signOut: { marginTop: 32 },
  signOutText: { fontSize: 14, color: "#a3acb5" },
});
