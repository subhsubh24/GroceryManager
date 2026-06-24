import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { api, isAuthenticated } from "./lib/api";

type PantryItem = {
  canonicalItemId: string;
  name: string;
  status: string;
  baseQtyOnHand: number | null;
  confidence: number | null;
  estimatedRunOutAt: string | null;
  lastPurchaseAt: string | null;
  domain: string;
};

const STATUS_COLOR: Record<string, string> = {
  in_stock: "#0c8a3e",
  low: "#b6791a",    // warn token
  out: "#52596a",    // ink-500 token
  expired_likely: "#c0392b", // danger token
};

const STATUS_LABEL: Record<string, string> = {
  in_stock: "In stock",
  low: "Running low",
  out: "Out",
  expired_likely: "Likely expired",
};

const SMALL = new Set(["and", "or", "of", "the", "a", "an", "with", "in", "on", "to", "for"]);
function titleCase(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w, i) => {
      if (!w) return w;
      if (i > 0 && SMALL.has(w.toLowerCase())) return w.toLowerCase();
      return w[0]!.toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

export default function Pantry() {
  const router = useRouter();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated()) {
      router.replace("/signin");
      return;
    }
    try {
      const data = (await api.getPantry()) as { items?: PantryItem[] };
      setItems(data.items ?? []);
      setError(null);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "AUTH_401") {
        router.replace("/signin");
        return;
      }
      setError("Couldn't load pantry. Pull to refresh.");
    }
  }, [router]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0c8a3e" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>PANTRY</Text>
        <Text style={styles.title}>What&apos;s in stock</Text>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {items.length === 0 && !error && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Your pantry is empty. Add receipts to get started.
          </Text>
        </View>
      )}
      <FlatList
        data={items}
        keyExtractor={(item) => item.canonicalItemId}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.itemName}>{titleCase(item.name)}</Text>
              {item.estimatedRunOutAt && (
                <Text style={styles.itemSub}>
                  Runs out ~{new Date(item.estimatedRunOutAt).toLocaleDateString()}
                </Text>
              )}
            </View>
            <View
              style={[
                styles.pill,
                { backgroundColor: STATUS_COLOR[item.status] ?? "#52596a" },
              ]}
            >
              <Text style={styles.pillText}>
                {STATUS_LABEL[item.status] ?? item.status}
              </Text>
            </View>
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0c8a3e"
          />
        }
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf8f3" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#ece7dd",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: "#0c8a3e",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: { fontSize: 22, fontWeight: "700", color: "#1d2530" },
  list: { paddingBottom: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#fff",
  },
  rowLeft: { flex: 1, marginRight: 12 },
  itemName: { fontSize: 16, fontWeight: "500", color: "#1d2530" },
  itemSub: { fontSize: 12, color: "#525d6a", marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  pillText: { fontSize: 12, fontWeight: "600", color: "#fff" },
  divider: { height: 1, backgroundColor: "#ece7dd", marginLeft: 20 },
  empty: { padding: 24 },
  emptyText: { fontSize: 15, color: "#525d6a", textAlign: "center" },
  error: { fontSize: 14, color: "#c0392b", margin: 16, textAlign: "center" },
});
