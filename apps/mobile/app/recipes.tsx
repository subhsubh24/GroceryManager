import { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, StyleSheet, Pressable } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";

type Recipe = {
  id: string;
  title: string;
  imageUrl?: string;
  cuisine?: string;
};

export default function RecipesScreen() {
  const { token } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!token) return <Redirect href="/login" />;

  function load() {
    setLoading(true);
    setError(null);
    let cancelled = false;
    apiFetch("/api/mobile/recipes", token!)
      .then(async (res) => {
        if (!res.ok) { if (!cancelled) setError("Failed to load recipes."); return; }
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
          <Text style={styles.emptyTitle}>No saved recipes yet</Text>
          <Text style={styles.emptyNote}>
            Save recipes from the web app to see them here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.recipeTitle}>{item.title}</Text>
              {item.cuisine ? (
                <Text style={styles.recipeCuisine}>{item.cuisine}</Text>
              ) : null}
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
    padding: 18,
    borderWidth: 1,
    borderColor: "#ece7dd",
  },
  recipeTitle: { fontSize: 15, fontWeight: "700", color: "#1d2530" },
  recipeCuisine: { fontSize: 12, color: "#525d6a", marginTop: 4 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1d2530" },
  emptyNote: { fontSize: 14, color: "#525d6a", marginTop: 6, textAlign: "center" },
  errorText: { fontSize: 15, color: "#991b1b", textAlign: "center" },
  retryButton: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 24, backgroundColor: "#0c8a3e", borderRadius: 10 },
  retryText: { color: "#ffffff", fontWeight: "600" },
});
