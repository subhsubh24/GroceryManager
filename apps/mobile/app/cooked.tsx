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

interface Meal {
  id: string;
  title: string | null;
  imageUrl: string | null;
  cookedAt: string;
  servingsMade: number | null;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

function macroLine(m: Pick<Meal, "kcal" | "proteinG" | "carbsG" | "fatG">): string {
  if (m.kcal == null && m.proteinG == null && m.carbsG == null && m.fatG == null) return "—";
  const g = (v: number | null) => (v == null ? "–" : `${Math.round(v)}g`);
  const kcal = m.kcal == null ? "–" : `${Math.round(m.kcal)} kcal`;
  return `${kcal} · P ${g(m.proteinG)} · C ${g(m.carbsG)} · F ${g(m.fatG)}`;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function CookedScreen() {
  const { token } = useAuth();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch("/api/mobile/cooked", token)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load meals.");
        return res.json() as Promise<{ meals: Meal[] }>;
      })
      .then((data) => {
        if (!cancelled) setMeals(data.meals ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load meals — check your connection.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
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
        >
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  // Today's meals and running totals
  const todays = meals.filter((m) => isToday(m.cookedAt));
  const hasMacros = todays.some((m) => m.kcal != null);
  const todayTotal = todays.reduce(
    (acc, m) => ({
      kcal: acc.kcal + (m.kcal ?? 0),
      proteinG: acc.proteinG + (m.proteinG ?? 0),
      carbsG: acc.carbsG + (m.carbsG ?? 0),
      fatG: acc.fatG + (m.fatG ?? 0),
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  if (meals.length === 0) {
    return (
      <View style={styles.center}>
        <View style={styles.emptyMark}>
          <Text style={styles.emptyGlyph}>GM</Text>
        </View>
        <Text style={styles.emptyTitle}>No cooks logged yet</Text>
        <Text style={styles.emptyNote}>
          Cook a recipe and tap "I cooked this" — it lands here with its macros.
        </Text>
        <Pressable style={styles.browseBtn} onPress={() => router.push("/recipes")}>
          <Text style={styles.browseBtnText}>Find something to cook →</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={meals}
      keyExtractor={(m) => m.id}
      ListHeaderComponent={
        todays.length > 0 ? (
          <View style={styles.todayPanel}>
            <Text style={styles.todayEyebrow}>
              Today · {todays.length} {todays.length === 1 ? "meal" : "meals"}
            </Text>
            {hasMacros ? (
              <>
                <Text style={styles.todayKcal}>{Math.round(todayTotal.kcal)} kcal</Text>
                <Text style={styles.todayMacros}>
                  P {Math.round(todayTotal.proteinG)}g · C {Math.round(todayTotal.carbsG)}g · F{" "}
                  {Math.round(todayTotal.fatG)}g
                </Text>
              </>
            ) : (
              <Text style={styles.todayKcal}>—</Text>
            )}
          </View>
        ) : null
      }
      renderItem={({ item: m }) => (
        <View style={styles.mealCard}>
          {m.imageUrl?.startsWith("https://") ? (
            <Image source={{ uri: m.imageUrl }} style={styles.mealImg} />
          ) : (
            <View style={styles.mealImgPlaceholder}>
              <Text style={styles.mealImgPlaceholderText}>
                {(m.title ?? "M").charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.mealInfo}>
            <View style={styles.mealTitleRow}>
              <Text style={styles.mealTitle} numberOfLines={1}>
                {m.title ?? "Logged meal"}
              </Text>
              <Text style={styles.mealDate}>{fmtDate(m.cookedAt)}</Text>
            </View>
            <Text style={styles.mealServings}>
              {m.servingsMade != null
                ? `${m.servingsMade} ${m.servingsMade === 1 ? "serving" : "servings"}`
                : "1 serving"}
            </Text>
            <Text style={styles.mealMacros}>{macroLine(m)}</Text>
          </View>
        </View>
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf8f3" },
  content: { padding: 16, paddingBottom: 48 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#faf8f3" },
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
  browseBtn: {
    backgroundColor: "#0c8a3e",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  browseBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "600" },

  todayPanel: {
    backgroundColor: "#0c8a3e",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  todayEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  todayKcal: { fontSize: 28, fontWeight: "800", color: "#ffffff" },
  todayMacros: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 2 },

  mealCard: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ece7dd",
    gap: 12,
    alignItems: "flex-start",
  },
  mealImg: { width: 64, height: 64, borderRadius: 10 },
  mealImgPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: "#f0faf4",
    alignItems: "center",
    justifyContent: "center",
  },
  mealImgPlaceholderText: { fontSize: 22, fontWeight: "700", color: "#0c8a3e" },
  mealInfo: { flex: 1 },
  mealTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  mealTitle: { fontSize: 15, fontWeight: "600", color: "#1d2530", flex: 1 },
  mealDate: { fontSize: 12, color: "#a3acb5", flexShrink: 0 },
  mealServings: { fontSize: 12, color: "#a3acb5", marginTop: 2 },
  mealMacros: { fontSize: 13, color: "#525d6a", marginTop: 4 },

  separator: { height: 10 },
});
