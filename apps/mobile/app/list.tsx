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

type ListItem = {
  id: string;
  name: string;
  qty: number | null;
  unit: string | null;
  checked: boolean;
  domain: string | null;
};

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function List() {
  const router = useRouter();
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated()) {
      router.replace("/signin");
      return;
    }
    try {
      const data = (await api.getList()) as { items?: ListItem[] };
      setItems(data.items ?? []);
      setError(null);
    } catch {
      setError("Couldn't load your list. Pull to refresh.");
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

  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>SHOPPING LIST</Text>
        <Text style={styles.title}>What to buy</Text>
        {unchecked.length > 0 && (
          <Text style={styles.count}>
            {unchecked.length} item{unchecked.length !== 1 ? "s" : ""}
          </Text>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {items.length === 0 && !error && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Your list is empty. Items running low will appear here.
          </Text>
        </View>
      )}
      <FlatList
        data={[...unchecked, ...checked]}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={[styles.row, item.checked && styles.rowChecked]}>
            <View style={[styles.checkbox, item.checked && styles.checkboxChecked]} />
            <View style={styles.rowContent}>
              <Text style={[styles.itemName, item.checked && styles.itemNameChecked]}>
                {titleCase(item.name)}
              </Text>
              {(item.qty != null || item.unit) && (
                <Text style={styles.itemQty}>
                  {item.qty != null ? String(item.qty) : ""}
                  {item.unit ? ` ${item.unit}` : ""}
                </Text>
              )}
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
  count: { fontSize: 14, color: "#525d6a", marginTop: 2 },
  list: { paddingBottom: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#fff",
  },
  rowChecked: { opacity: 0.5 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#0c8a3e",
    marginRight: 14,
  },
  checkboxChecked: { backgroundColor: "#0c8a3e", borderColor: "#0c8a3e" },
  rowContent: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: "500", color: "#1d2530" },
  itemNameChecked: { textDecorationLine: "line-through", color: "#6b7280" },
  itemQty: { fontSize: 13, color: "#525d6a", marginTop: 2 },
  divider: { height: 1, backgroundColor: "#ece7dd", marginLeft: 56 },
  empty: { padding: 24 },
  emptyText: { fontSize: 15, color: "#525d6a", textAlign: "center" },
  error: { fontSize: 14, color: "#dc2626", margin: 16, textAlign: "center" },
});
