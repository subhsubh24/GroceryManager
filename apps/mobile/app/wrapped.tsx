import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Share,
} from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";

type WrappedStats = {
  periodLabel: string;
  homeCookedMeals: number;
  totalSpentCents: number;
  estSavedCents: number;
  itemsExpired: number;
  topRecipes: { title: string; count: number }[];
};

const fmt = (cents: number) => `$${(cents / 100).toFixed(0)}`;

export default function WrappedScreen() {
  const { token } = useAuth();
  const [stats, setStats] = useState<WrappedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return () => {};
    setLoading(true);
    setError(null);
    let cancelled = false;
    apiFetch("/api/mobile/wrapped", token)
      .then(async (res) => {
        if (!res.ok) { if (!cancelled) setError("Failed to load your Wrapped."); return; }
        const d = (await res.json()) as { stats: WrappedStats };
        if (!cancelled) setStats(d.stats);
      })
      .catch(() => { if (!cancelled) setError("Network error — check your connection."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  if (!token) return <Redirect href="/login" />;

  async function shareWrapped() {
    if (!stats) return;
    const lines = [
      `My Grocery Wrapped — ${stats.periodLabel}`,
      `${stats.homeCookedMeals} home-cooked meals`,
      stats.estSavedCents > 0 ? `~${fmt(stats.estSavedCents)} saved vs takeout` : null,
      stats.itemsExpired > 0 ? `${stats.itemsExpired} items let expire` : null,
      stats.topRecipes[0] ? `Top: ${stats.topRecipes[0].title}` : null,
    ].filter(Boolean);
    try {
      await Share.share({ message: lines.join("\n") });
    } catch {
      // Share dialog dismissed or not supported — no-op
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0c8a3e" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={load}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const empty = !stats || (stats.homeCookedMeals === 0 && stats.totalSpentCents === 0 && stats.topRecipes.length === 0);

  if (empty) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Nothing yet</Text>
        <Text style={styles.emptyNote}>
          Cook meals and add receipts — your Grocery Wrapped fills in from your own data.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>Your {stats!.periodLabel} in food</Text>
        <Text style={styles.heroTitle}>Grocery Wrapped</Text>
        <Text style={styles.heroNote}>Built only from your own data.</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, styles.statAccent]}>
          <Text style={styles.statValueAccent}>{stats!.homeCookedMeals}</Text>
          <Text style={styles.statLabelAccent}>Home-cooked meals</Text>
        </View>
        {stats!.estSavedCents > 0 && (
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{fmt(stats!.estSavedCents)}</Text>
            <Text style={styles.statLabel}>Saved vs takeout (est.)</Text>
          </View>
        )}
        {stats!.totalSpentCents > 0 && (
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{fmt(stats!.totalSpentCents)}</Text>
            <Text style={styles.statLabel}>Spent on groceries</Text>
          </View>
        )}
        {stats!.itemsExpired > 0 && (
          <View style={[styles.statCard, styles.statWarn]}>
            <Text style={styles.statValueWarn}>{stats!.itemsExpired}</Text>
            <Text style={styles.statLabelWarn}>Items let expire</Text>
          </View>
        )}
      </View>

      {stats!.topRecipes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top recipes</Text>
          {stats!.topRecipes.map((r, i) => (
            <View
              key={r.title}
              style={[styles.recipeRow, i === stats!.topRecipes.length - 1 && styles.recipeRowLast]}
            >
              <Text style={styles.recipeRank}>{i + 1}</Text>
              <Text style={styles.recipeTitle} numberOfLines={1}>{r.title}</Text>
              <Text style={styles.recipeCount}>{r.count}×</Text>
            </View>
          ))}
        </View>
      )}

      <Pressable style={styles.shareButton} onPress={shareWrapped}>
        <Text style={styles.shareButtonText}>Share my Wrapped</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf8f3" },
  content: { padding: 20, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  hero: {
    backgroundColor: "#0c8a3e",
    borderRadius: 24,
    padding: 28,
    marginBottom: 20,
    alignItems: "center",
  },
  heroEyebrow: { fontSize: 12, color: "rgba(255,255,255,0.65)", fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  heroTitle: { fontSize: 32, fontWeight: "800", color: "#ffffff", letterSpacing: -0.5 },
  heroNote: { fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 6 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ece7dd",
    padding: 18,
  },
  statAccent: { backgroundColor: "#f0faf4", borderColor: "#bbf7d0" },
  statWarn: { backgroundColor: "#fefce8", borderColor: "#fde68a" },
  statValue: { fontSize: 28, fontWeight: "800", color: "#1d2530", letterSpacing: -0.5 },
  statValueAccent: { fontSize: 28, fontWeight: "800", color: "#0c8a3e", letterSpacing: -0.5 },
  statValueWarn: { fontSize: 28, fontWeight: "800", color: "#b6791a", letterSpacing: -0.5 },
  statLabel: { fontSize: 12, color: "#525d6a", marginTop: 4 },
  statLabelAccent: { fontSize: 12, color: "#0c8a3e", marginTop: 4, fontWeight: "600" },
  statLabelWarn: { fontSize: 12, color: "#b6791a", marginTop: 4, fontWeight: "600" },
  section: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ece7dd",
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#525d6a", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 },
  recipeRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f3ede4" },
  recipeRowLast: { borderBottomWidth: 0 },
  recipeRank: { fontSize: 13, fontWeight: "800", color: "#0c8a3e", width: 24 },
  recipeTitle: { flex: 1, fontSize: 15, color: "#1d2530", fontWeight: "600" },
  recipeCount: { fontSize: 13, color: "#525d6a" },
  shareButton: { backgroundColor: "#0c8a3e", borderRadius: 16, padding: 16, alignItems: "center" },
  shareButtonText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1d2530", marginBottom: 8 },
  emptyNote: { fontSize: 14, color: "#525d6a", textAlign: "center", lineHeight: 20 },
  errorText: { fontSize: 15, color: "#c0392b", marginBottom: 16 },
  retryButton: { backgroundColor: "#0c8a3e", paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: "#ffffff", fontWeight: "700" },
});
