import { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, StyleSheet, ScrollView } from "react-native";
import { Redirect, Link } from "expo-router";
import { titleCase } from "@gm/core/format";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";

type MonthPeriod = { periodStart: string; totalCents: number };
type TopItem = { name: string; totalCents: number };
type BudgetStatus = {
  actualCents: number;
  budgetCents: number | null;
  deltaCents: number | null;
  overBudget: boolean;
};
type SpendData = {
  upgradeRequired?: boolean;
  empty: boolean;
  thisMonthCents: number;
  months: MonthPeriod[];
  budget: BudgetStatus;
  top: TopItem[];
};

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function periodLabel(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export default function SpendScreen() {
  const { token } = useAuth();
  const [data, setData] = useState<SpendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!token) return () => {};
    setLoading(true);
    setError(null);
    let cancelled = false;
    apiFetch("/api/mobile/spend", token)
      .then(async (res) => {
        if (!res.ok) { if (!cancelled) setError("Failed to load spend data."); return; }
        const d = (await res.json()) as SpendData;
        if (!cancelled) setData(d);
      })
      .catch(() => { if (!cancelled) setError("Network error — check your connection."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }

  useEffect(load, [token]);

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
          style={styles.retryButton}
          onPress={load}
          accessibilityRole="button"
          accessibilityLabel="Retry"
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (data?.upgradeRequired) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Premium feature</Text>
        <Text style={styles.emptyNote}>Spend insights are a premium feature.</Text>
        <Link
          href="/upgrade"
          style={styles.upgradeButton}
          accessibilityRole="button"
          accessibilityLabel="See plans"
        >
          <Text style={styles.upgradeText}>See plans →</Text>
        </Link>
      </View>
    );
  }

  if (!data || data.empty) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No spend data yet</Text>
        <Text style={styles.emptyNote}>Once receipts land, your spending summary fills in here.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>This month</Text>
        <Text style={styles.heroAmount}>{fmt(data.thisMonthCents)}</Text>
      </View>

      {data.budget.budgetCents != null && (
        <View style={[styles.section, styles.budgetSection, data.budget.overBudget ? styles.budgetOver : styles.budgetUnder]}>
          <Text style={styles.budgetSectionLabel}>This week</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Spent</Text>
            <Text style={styles.rowValue}>{fmt(data.budget.actualCents)}</Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.rowLabel}>Weekly budget</Text>
            <Text style={styles.rowValue}>{fmt(data.budget.budgetCents)}</Text>
          </View>
          <Text style={[styles.budgetDelta, data.budget.overBudget ? styles.over : styles.under]}>
            {data.budget.overBudget
              ? `${fmt(Math.abs(data.budget.deltaCents ?? 0))} over budget this week`
              : `${fmt(Math.abs(data.budget.deltaCents ?? 0))} under budget this week`}
          </Text>
        </View>
      )}

      {data.months.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monthly history</Text>
          {data.months.map((m) => (
            <View key={m.periodStart} style={styles.row}>
              <Text style={styles.rowLabel}>{periodLabel(m.periodStart)}</Text>
              <Text style={styles.rowValue}>{fmt(m.totalCents)}</Text>
            </View>
          ))}
        </View>
      )}

      {data.top.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top items by spend</Text>
          {data.top.map((item, i) => (
            <View key={item.name + i} style={styles.row}>
              <Text style={styles.rowLabel} numberOfLines={1}>{titleCase(item.name)}</Text>
              <Text style={styles.rowValue}>{fmt(item.totalCents)}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf8f3" },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  heroCard: {
    backgroundColor: "#0c8a3e",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    marginBottom: 24,
  },
  heroLabel: { fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: "600", marginBottom: 4 },
  heroAmount: { fontSize: 42, fontWeight: "800", color: "#ffffff", letterSpacing: -1 },
  section: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ece7dd",
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#525d6a", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  budgetSection: { borderWidth: 1 },
  budgetOver: { borderColor: "#c0392b", backgroundColor: "#fef2f0" },
  budgetUnder: { borderColor: "#ece7dd", backgroundColor: "#ffffff" },
  budgetSectionLabel: { fontSize: 13, fontWeight: "700", color: "#525d6a", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  budgetDelta: { fontSize: 13, fontWeight: "600", marginTop: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f3ede4" },
  rowLabel: { fontSize: 15, color: "#1d2530", flex: 1, marginRight: 12 },
  rowValue: { fontSize: 15, fontWeight: "700", color: "#0c8a3e" },
  over: { color: "#c0392b" },
  under: { color: "#0c8a3e" },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1d2530", marginBottom: 8 },
  emptyNote: { fontSize: 14, color: "#525d6a", textAlign: "center" },
  upgradeButton: { backgroundColor: "#0c8a3e", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  upgradeText: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
  errorText: { fontSize: 15, color: "#c0392b", marginBottom: 16 },
  retryButton: { backgroundColor: "#0c8a3e", paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: "#ffffff", fontWeight: "700" },
});
