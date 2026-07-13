import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { Redirect, router } from "expo-router";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";

interface WeekBucket {
  weekStart: string;
  count: number;
}

interface DigestData {
  currentStreak: number;
  longestStreak: number;
  cooksThisWeek: number;
  totalCooks: number;
  weeklyActivity: WeekBucket[];
}

function fmtWeekLabel(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00Z");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

export default function DigestScreen() {
  const { token } = useAuth();
  const [data, setData] = useState<DigestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch("/api/mobile/digest", token)
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.json() as Promise<DigestData>;
      })
      // Normalise the array field at the trust boundary: `res.json() as DigestData` is a compile-time
      // cast with no runtime guarantee, so a partial 200 could omit weeklyActivity and crash the chart
      // render on `.map`. Defaulting to [] here keeps every consumer safe.
      .then((d) => { if (!cancelled) setData({ ...d, weeklyActivity: d.weeklyActivity ?? [] }); })
      .catch(() => { if (!cancelled) setError("Couldn't load stats — check your connection."); })
      .finally(() => { if (!cancelled) setLoading(false); });
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
          accessibilityRole="button"
          accessibilityLabel="Retry"
        >
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!data) return null;

  const maxCount = Math.max(...data.weeklyActivity.map((w) => w.count), 1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Streak hero */}
      <View style={styles.streakCard}>
        <Text style={styles.streakEyebrow}>Current streak</Text>
        <Text style={styles.streakNumber}>{data.currentStreak}</Text>
        <Text style={styles.streakUnit}>
          {data.currentStreak === 1 ? "day" : "days"}
        </Text>
        {data.currentStreak === 0 && (
          <Text style={styles.streakNudge}>Cook something today to start a streak</Text>
        )}
      </View>

      {/* Stat row */}
      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{data.longestStreak}</Text>
          <Text style={styles.statLabel}>Longest streak</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{data.cooksThisWeek}</Text>
          <Text style={styles.statLabel}>Cooks this week</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{data.totalCooks}</Text>
          <Text style={styles.statLabel}>Total cooks</Text>
        </View>
      </View>

      {/* 8-week activity bar chart */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>8-week activity</Text>
        <View style={styles.barChart}>
          {data.weeklyActivity.map((w) => (
            <View key={w.weekStart} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { height: `${Math.round((w.count / maxCount) * 100)}%` },
                    w.count === 0 && styles.barFillEmpty,
                  ]}
                />
              </View>
              <Text style={styles.barLabel}>{fmtWeekLabel(w.weekStart)}</Text>
              {w.count > 0 && <Text style={styles.barCount}>{w.count}</Text>}
            </View>
          ))}
        </View>
      </View>

      {/* CTAs */}
      <View style={styles.ctaRow}>
        <Pressable
          style={styles.ctaBtn}
          onPress={() => router.push("/cooked")}
          accessibilityRole="button"
          accessibilityLabel="Cook log"
        >
          <Text style={styles.ctaBtnText}>Cook log →</Text>
        </Pressable>
        <Pressable
          style={[styles.ctaBtn, styles.ctaBtnSecondary]}
          onPress={() => router.push("/cook-tonight")}
          accessibilityRole="button"
          accessibilityLabel="Cook tonight"
        >
          <Text style={styles.ctaBtnTextSecondary}>Cook tonight →</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf8f3" },
  content: { padding: 16, paddingBottom: 48 },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#faf8f3",
  },
  errorText: { fontSize: 15, color: "#c0392b", textAlign: "center", marginBottom: 16 },
  retryBtn: {
    backgroundColor: "#0c8a3e",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "600" },

  streakCard: {
    backgroundColor: "#0c8a3e",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  streakEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  streakNumber: { fontSize: 72, fontWeight: "800", color: "#ffffff", lineHeight: 80 },
  streakUnit: { fontSize: 18, color: "rgba(255,255,255,0.85)", fontWeight: "600", marginTop: 2 },
  streakNudge: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginTop: 12,
    textAlign: "center",
  },

  statRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ece7dd",
  },
  statNumber: { fontSize: 26, fontWeight: "800", color: "#1d2530" },
  statLabel: { fontSize: 11, color: "#a3acb5", fontWeight: "600", marginTop: 2, textAlign: "center" },

  section: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ece7dd",
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#a3acb5",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 14,
  },

  barChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    height: 100,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
  },
  barTrack: {
    width: "100%",
    height: 72,
    justifyContent: "flex-end",
  },
  barFill: {
    width: "100%",
    backgroundColor: "#0c8a3e",
    borderRadius: 4,
    minHeight: 3,
  },
  barFillEmpty: {
    backgroundColor: "#ece7dd",
    minHeight: 3,
    height: "100%",
  },
  barLabel: {
    fontSize: 8,
    color: "#a3acb5",
    marginTop: 4,
    textAlign: "center",
  },
  barCount: {
    fontSize: 9,
    color: "#0c8a3e",
    fontWeight: "700",
  },

  ctaRow: { flexDirection: "row", gap: 10 },
  ctaBtn: {
    flex: 1,
    backgroundColor: "#0c8a3e",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
  ctaBtnSecondary: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#ece7dd",
  },
  ctaBtnTextSecondary: { color: "#1d2530", fontSize: 15, fontWeight: "700" },
});
