import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
} from "react-native";
import { Redirect, Link } from "expo-router";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";

type Dinner = {
  recipeId: string;
  day: string;
  title: string;
  reason: string;
  usesExpiring: string[];
  imageUrl: string | null;
};

type Plan = {
  narrative: string;
  dinners: Dinner[];
  addToList: string[];
};

type PlanData =
  | { upgradeRequired: true; empty?: false }
  | { empty: true; upgradeRequired: false; plan: null }
  | { empty: false; upgradeRequired: false; source: "llm" | "fallback"; plan: Plan }
  | { error: string };

export default function PlanScreen() {
  const { token } = useAuth();
  const [data, setData] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);

  if (!token) return <Redirect href="/login" />;

  const load = useCallback(() => {
    setLoading(true);
    setData(null);
    let cancelled = false;
    apiFetch("/api/mobile/plan", token!)
      .then(async (res) => {
        const d = (await res.json()) as PlanData;
        if (!cancelled) setData(d);
      })
      .catch(() => { if (!cancelled) setData({ error: "Network error — check your connection." }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0c8a3e" />
        <Text style={styles.loadingNote}>Building your week…</Text>
      </View>
    );
  }

  if (!data || "error" in data) {
    const msg = !data ? "Something went wrong." : (data as { error: string }).error;
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{msg}</Text>
        <Pressable style={styles.retryButton} onPress={load}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (data.upgradeRequired) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Premium feature</Text>
        <Text style={styles.emptyNote}>Upgrade to unlock AI-powered weekly meal plans.</Text>
        <Link href="/upgrade" style={styles.upgradeButton}>
          <Text style={styles.upgradeText}>See plans →</Text>
        </Link>
      </View>
    );
  }

  if (data.empty) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Pantry is empty</Text>
        <Text style={styles.emptyNote}>Add items to your pantry and I'll plan your week around them.</Text>
      </View>
    );
  }

  const { plan, source } = data as { plan: Plan; source: "llm" | "fallback" };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.narrativeCard}>
        <Text style={styles.narrativeLabel}>{source === "llm" ? "AI plan" : "This week"}</Text>
        <Text style={styles.narrativeText}>{plan.narrative}</Text>
      </View>

      {plan.dinners.map((dinner) => (
        <View key={`${dinner.recipeId}-${dinner.day}`} style={styles.dinnerCard}>
          {dinner.imageUrl ? (
            <Image source={{ uri: dinner.imageUrl }} style={styles.dinnerImage} />
          ) : (
            <View style={[styles.dinnerImage, styles.imagePlaceholder]} />
          )}
          <View style={styles.dinnerInfo}>
            <Text style={styles.dinnerDay}>{dinner.day}</Text>
            <Text style={styles.dinnerTitle} numberOfLines={2}>{dinner.title}</Text>
            {dinner.reason ? (
              <Text style={styles.dinnerReason} numberOfLines={2}>{dinner.reason}</Text>
            ) : null}
            {dinner.usesExpiring.length > 0 && (
              <Text style={styles.dinnerExpiring}>
                Uses up: {dinner.usesExpiring.join(", ")}
              </Text>
            )}
          </View>
        </View>
      ))}

      {plan.addToList.length > 0 && (
        <View style={styles.listSection}>
          <Text style={styles.listTitle}>To pick up</Text>
          {plan.addToList.map((item, i) => (
            <View key={`${item}-${i}`} style={styles.listRow}>
              <View style={styles.listDot} />
              <Text style={styles.listItem}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      <Pressable style={styles.refreshButton} onPress={load}>
        <Text style={styles.refreshText}>
          {source === "llm" ? "Regenerate plan" : "Refresh"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf8f3" },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  loadingNote: { marginTop: 12, fontSize: 14, color: "#525d6a" },
  narrativeCard: {
    backgroundColor: "#0c8a3e",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  narrativeLabel: { fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 },
  narrativeText: { fontSize: 15, color: "#ffffff", lineHeight: 22 },
  dinnerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ece7dd",
    marginBottom: 12,
    overflow: "hidden",
    flexDirection: "row",
  },
  dinnerImage: { width: 88, height: 88 },
  imagePlaceholder: { backgroundColor: "#ece7dd" },
  dinnerInfo: { flex: 1, padding: 12 },
  dinnerDay: { fontSize: 11, fontWeight: "700", color: "#0c8a3e", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  dinnerTitle: { fontSize: 15, fontWeight: "700", color: "#1d2530", marginBottom: 4 },
  dinnerReason: { fontSize: 12, color: "#525d6a", lineHeight: 16 },
  dinnerExpiring: { fontSize: 11, color: "#b6791a", fontWeight: "600", marginTop: 4 },
  listSection: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ece7dd",
    padding: 16,
    marginTop: 4,
    marginBottom: 16,
  },
  listTitle: { fontSize: 13, fontWeight: "700", color: "#525d6a", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  listRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  listDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#0c8a3e", marginRight: 10 },
  listItem: { fontSize: 15, color: "#1d2530" },
  refreshButton: { borderWidth: 1, borderColor: "#0c8a3e", borderRadius: 12, padding: 14, alignItems: "center", marginTop: 8 },
  refreshText: { fontSize: 14, fontWeight: "700", color: "#0c8a3e" },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1d2530" },
  emptyNote: { fontSize: 14, color: "#525d6a", textAlign: "center" },
  upgradeButton: { backgroundColor: "#0c8a3e", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  upgradeText: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
  errorText: { fontSize: 15, color: "#c0392b", textAlign: "center" },
  retryButton: { backgroundColor: "#0c8a3e", paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: "#ffffff", fontWeight: "700" },
});
