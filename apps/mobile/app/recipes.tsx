import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  Image,
  RefreshControl,
} from "react-native";
import { Link, Redirect } from "expo-router";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";

type SavedRecipe = {
  id: string;
  title: string;
  imageUrl?: string;
  cuisine?: string;
};

export default function RecipesScreen() {
  const { token } = useAuth();
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) return <Redirect href="/login" />;

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await apiFetch("/api/mobile/recipes", token!);
        if (!res.ok) {
          setError("Failed to load recipes.");
          return;
        }
        const data = (await res.json()) as { recipes: SavedRecipe[] };
        setRecipes(data.recipes ?? []);
      } catch {
        setError("Network error — check your connection.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    load();
  }, [load]);

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
        <Pressable style={styles.retryButton} onPress={() => load()}>
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#0c8a3e"
            />
          }
          renderItem={({ item }) => (
            <Link href={`/cook/${item.id}`} asChild>
              <Pressable style={styles.card}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Text style={styles.thumbLabel}>Recipe</Text>
                  </View>
                )}
                <View style={styles.cardText}>
                  <Text style={styles.title} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.cuisine ? (
                    <Text style={styles.cuisine}>{item.cuisine}</Text>
                  ) : null}
                </View>
                <Text style={styles.arrow}>›</Text>
              </Pressable>
            </Link>
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
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ece7dd",
    overflow: "hidden",
  },
  thumb: { width: 72, height: 72 },
  thumbPlaceholder: {
    backgroundColor: "#f0ede7",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbLabel: { fontSize: 11, fontWeight: "600", color: "#9ba8b4", letterSpacing: 0.5, textTransform: "uppercase" },
  cardText: { flex: 1, paddingHorizontal: 14, paddingVertical: 10 },
  title: { fontSize: 15, fontWeight: "600", color: "#1d2530", lineHeight: 20 },
  cuisine: { fontSize: 12, color: "#0c8a3e", marginTop: 4, fontWeight: "500" },
  arrow: { fontSize: 22, color: "#c8c1b8", paddingRight: 14 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1d2530" },
  emptyNote: { fontSize: 14, color: "#525d6a", marginTop: 6, textAlign: "center" },
  errorText: { fontSize: 15, color: "#c0392b", textAlign: "center" },
  retryButton: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 24, backgroundColor: "#0c8a3e", borderRadius: 10 },
  retryText: { color: "#ffffff", fontWeight: "600" },
});
