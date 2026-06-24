import { useEffect, useState } from "react";
import { View, Text, FlatList, Image, ActivityIndicator, StyleSheet, Pressable } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";

type Recipe = {
  id: string;
  title: string;
  imageUrl: string | null;
  haveCount: number;
  cuisine: string | null;
};

export default function CookTonightScreen() {
  const { token } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!token) return <Redirect href="/login" />;

  function load() {
    setLoading(true);
    setError(null);
    let cancelled = false;
    apiFetch("/api/mobile/cook-tonight", token!)
      .then(async (res) => {
        if (!res.ok) { if (!cancelled) setError("Failed to load suggestions."); return; }
        const data = (await res.json()) as { recipes: Recipe[] };
        if (!cancelled) setRecipes(data.recipes ?? []);
      })
      .catch(() => { if (!cancelled) setError("Network error — check your connection."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }

  useEffect(load, [token]);

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

  return (
    <View style={styles.container}>
      {recipes.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing to suggest yet</Text>
          <Text style={styles.emptyNote}>
            Add items to your pantry in the web app and we'll find matching recipes.
          </Text>
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
              ) : (
                <View style={styles.imagePlaceholder} />
              )}
              <View style={styles.cardBody}>
                <Text style={styles.recipeTitle}>{item.title}</Text>
                <View style={styles.meta}>
                  {item.cuisine ? (
                    <Text style={styles.metaText}>{item.cuisine}</Text>
                  ) : null}
                  <Text style={styles.matchText}>
                    {item.haveCount} ingredient{item.haveCount !== 1 ? "s" : ""} on hand
                  </Text>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf8f3" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  list: { padding: 16, gap: 10 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ece7dd",
    overflow: "hidden",
  },
  image: { width: "100%", height: 160 },
  imagePlaceholder: { width: "100%", height: 100, backgroundColor: "#ece7dd" },
  cardBody: { padding: 14 },
  recipeTitle: { fontSize: 15, fontWeight: "700", color: "#1d2530" },
  meta: { flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap" },
  metaText: { fontSize: 12, color: "#525d6a" },
  matchText: { fontSize: 12, color: "#0c8a3e", fontWeight: "600" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1d2530" },
  emptyNote: { fontSize: 14, color: "#525d6a", marginTop: 6, textAlign: "center" },
  errorText: { fontSize: 15, color: "#c0392b", textAlign: "center" },
  retryButton: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 24, backgroundColor: "#0c8a3e", borderRadius: 10 },
  retryText: { color: "#ffffff", fontWeight: "600" },
});
