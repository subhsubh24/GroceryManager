import { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, StyleSheet, Pressable } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";

type ListItem = {
  id: string;
  name: string;
  reason: string;
  checked: boolean;
};

const REASON_LABEL: Record<string, string> = {
  manual: "Added by you",
  reorder_engine: "Running low",
  recipe_plan: "For a recipe",
  agent: "AI suggestion",
};

export default function ListScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!token) return <Redirect href="/login" />;

  function load() {
    setLoading(true);
    setError(null);
    let cancelled = false;
    apiFetch("/api/mobile/list", token!)
      .then(async (res) => {
        if (!res.ok) { if (!cancelled) setError("Failed to load list."); return; }
        const data = (await res.json()) as { items: ListItem[] };
        if (!cancelled) setItems((data.items ?? []).filter((i) => !i.checked));
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
      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing on your list</Text>
          <Text style={styles.emptyNote}>
            Items appear here when your pantry runs low or you plan a recipe.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.dot} />
              <View style={styles.cardBody}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemReason}>
                  {REASON_LABEL[item.reason] ?? item.reason}
                </Text>
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
    padding: 16,
    borderWidth: 1,
    borderColor: "#ece7dd",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#0c8a3e",
  },
  cardBody: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: "600", color: "#1d2530" },
  itemReason: { fontSize: 12, color: "#525d6a", marginTop: 2 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1d2530" },
  emptyNote: { fontSize: 14, color: "#525d6a", marginTop: 6, textAlign: "center" },
  errorText: { fontSize: 15, color: "#c0392b", textAlign: "center" },
  retryButton: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 24, backgroundColor: "#0c8a3e", borderRadius: 10 },
  retryText: { color: "#ffffff", fontWeight: "600" },
});
