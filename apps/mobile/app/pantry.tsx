import { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, StyleSheet, Pressable } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";

type PantryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string | null;
  daysUntilExpiry: number | null;
};

export default function PantryScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!token) return <Redirect href="/login" />;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch("/api/mobile/pantry", token!);
        if (!res.ok) {
          setError("Failed to load pantry.");
          return;
        }
        const data = (await res.json()) as { items: PantryItem[] };
        if (!cancelled) setItems(data.items ?? []);
      } catch {
        if (!cancelled) setError("Network error — check your connection.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token]);

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
        <Pressable style={styles.retryButton} onPress={() => setLoading(true)}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Your pantry is empty</Text>
          <Text style={styles.emptyNote}>Add items by scanning receipts in the web app.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardMain}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemQty}>
                  {item.quantity}
                  {item.unit ? ` ${item.unit}` : ""}
                </Text>
              </View>
              {item.daysUntilExpiry !== null && (
                <Text
                  style={[
                    styles.expiry,
                    item.daysUntilExpiry <= 2 && styles.expiryUrgent,
                    item.daysUntilExpiry <= 5 && item.daysUntilExpiry > 2 && styles.expiryWarn,
                  ]}
                >
                  {item.daysUntilExpiry <= 0
                    ? "Expired"
                    : item.daysUntilExpiry === 1
                    ? "Expires tomorrow"
                    : `${item.daysUntilExpiry}d left`}
                </Text>
              )}
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
    justifyContent: "space-between",
  },
  cardMain: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: "600", color: "#1d2530" },
  itemQty: { fontSize: 13, color: "#525d6a", marginTop: 2 },
  expiry: { fontSize: 12, color: "#525d6a", marginLeft: 8 },
  expiryWarn: { color: "#d97706" },
  expiryUrgent: { color: "#dc2626" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1d2530" },
  emptyNote: { fontSize: 14, color: "#525d6a", marginTop: 6, textAlign: "center" },
  errorText: { fontSize: 15, color: "#991b1b", textAlign: "center" },
  retryButton: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 24, backgroundColor: "#0c8a3e", borderRadius: 10 },
  retryText: { color: "#ffffff", fontWeight: "600" },
});
