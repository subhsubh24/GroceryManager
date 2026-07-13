import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { Redirect, router } from "expo-router";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";

interface Recipe {
  id: string;
  title: string;
  imageUrl: string | null;
  cuisine: string | null;
  usesExpiring: number;
  haveCount: number;
}

interface ExpiringItem {
  name: string;
  daysLeft: number | null;
}

interface UseItUpData {
  recipes: Recipe[];
  expiring: ExpiringItem[];
}

function daysLabel(daysLeft: number | null): string {
  if (daysLeft == null) return "expiring soon";
  if (daysLeft <= 0) return "use today";
  if (daysLeft === 1) return "1 day left";
  return `${daysLeft} days left`;
}

export default function UseItUpScreen() {
  const { token } = useAuth();
  const [data, setData] = useState<UseItUpData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch("/api/mobile/use-it-up", token)
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.json() as Promise<UseItUpData>;
      })
      // Normalise array fields at the trust boundary: `res.json() as UseItUpData` is a compile-time
      // cast with no runtime guarantee, so a partial/degraded 200 could omit an array and white-screen
      // the native app on the first `.length`/`.map`. Defaulting to [] here keeps every consumer safe.
      .then((d) => { if (!cancelled) setData({ ...d, recipes: d.recipes ?? [], expiring: d.expiring ?? [] }); })
      .catch(() => { if (!cancelled) setError("Couldn't load — check your connection."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, attempt]);

  if (!token) return <Redirect href="/login" />;

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
        <Pressable
          style={styles.retryBtn}
          onPress={() => setAttempt((a) => a + 1)}
          accessibilityRole="button"
          accessibilityLabel="Retry"
        >
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!data || data.expiring.length === 0) {
    return (
      <View style={styles.center}>
        <View style={styles.emptyMark}>
          <Text style={styles.emptyGlyph}>GM</Text>
        </View>
        <Text style={styles.emptyTitle}>Nothing expiring soon</Text>
        <Text style={styles.emptyNote}>
          When pantry items are about to run out, recipe ideas appear here so nothing goes to waste.
        </Text>
        <Pressable
          style={styles.retryBtn}
          onPress={() => router.push("/pantry")}
          accessibilityRole="button"
          accessibilityLabel="Check pantry"
        >
          <Text style={styles.retryBtnText}>Check pantry →</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={data.recipes}
      keyExtractor={(r) => r.id}
      ListHeaderComponent={
        <>
          {/* At-risk banner */}
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>Use these up soon</Text>
            <View style={styles.chipRow}>
              {data.expiring.map((e) => (
                <View key={e.name} style={styles.chip}>
                  <Text style={styles.chipName}>{e.name}</Text>
                  <Text style={styles.chipDays}>{daysLabel(e.daysLeft)}</Text>
                </View>
              ))}
            </View>
          </View>

          {data.recipes.length === 0 ? (
            <View style={styles.noRecipes}>
              <Text style={styles.noRecipesText}>
                No matching recipes found for these items right now. Try adding more pantry items or
                check back later.
              </Text>
            </View>
          ) : (
            <Text style={styles.sectionLabel}>Recipes that use them</Text>
          )}
        </>
      }
      renderItem={({ item: r }) => (
        <Pressable style={styles.recipeCard} onPress={() => router.push(`/cook/${r.id}`)}>
          {r.imageUrl?.startsWith("https://") ? (
            <Image source={{ uri: r.imageUrl }} style={styles.recipeImg} />
          ) : (
            <View style={styles.recipeImgPlaceholder}>
              <Text style={styles.recipeImgLetter}>
                {(r.title ?? "R").charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.recipeInfo}>
            <Text style={styles.recipeTitle} numberOfLines={2}>{r.title}</Text>
            {r.cuisine ? <Text style={styles.recipeCuisine}>{r.cuisine}</Text> : null}
            <View style={styles.badgeRow}>
              <View style={styles.expiringBadge}>
                <Text style={styles.expiringBadgeText}>
                  Uses {r.usesExpiring} expiring
                </Text>
              </View>
              {r.haveCount > r.usesExpiring ? (
                <View style={styles.haveBadge}>
                  <Text style={styles.haveBadgeText}>
                    +{r.haveCount - r.usesExpiring} more in pantry
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </Pressable>
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf8f3" },
  content: { padding: 16, paddingBottom: 48 },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#faf8f3",
  },
  errorText: { fontSize: 15, color: "#c0392b", textAlign: "center", marginBottom: 16 },
  retryBtn: {
    backgroundColor: "#0c8a3e",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "600" },

  emptyMark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#0c8a3e",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyGlyph: { color: "#ffffff", fontSize: 20, fontWeight: "800" },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#1d2530", marginBottom: 8 },
  emptyNote: {
    fontSize: 14,
    color: "#525d6a",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
    maxWidth: 280,
  },

  banner: {
    backgroundColor: "#fffbeb",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#fde68a",
    padding: 16,
    marginBottom: 16,
  },
  bannerTitle: { fontSize: 13, fontWeight: "700", color: "#92400e", marginBottom: 10 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fcd34d",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipName: { fontSize: 13, fontWeight: "600", color: "#1d2530" },
  chipDays: { fontSize: 11, color: "#b45309", marginTop: 1 },

  noRecipes: { padding: 16, alignItems: "center" },
  noRecipesText: { fontSize: 14, color: "#525d6a", textAlign: "center", lineHeight: 20 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#a3acb5",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 12,
  },

  recipeCard: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ece7dd",
    overflow: "hidden",
    gap: 0,
  },
  recipeImg: { width: 80, height: 90 },
  recipeImgPlaceholder: {
    width: 80,
    height: 90,
    backgroundColor: "#fffbeb",
    alignItems: "center",
    justifyContent: "center",
  },
  recipeImgLetter: { fontSize: 28, fontWeight: "800", color: "#b45309" },
  recipeInfo: { flex: 1, padding: 12 },
  recipeTitle: { fontSize: 14, fontWeight: "600", color: "#1d2530", lineHeight: 19 },
  recipeCuisine: { fontSize: 12, color: "#0c8a3e", fontWeight: "500", marginTop: 2 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  expiringBadge: {
    backgroundColor: "#fffbeb",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#fcd34d",
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  expiringBadgeText: { fontSize: 11, color: "#92400e", fontWeight: "600" },
  haveBadge: {
    backgroundColor: "#f0faf4",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  haveBadgeText: { fontSize: 11, color: "#15803d", fontWeight: "600" },

  separator: { height: 10 },
});
