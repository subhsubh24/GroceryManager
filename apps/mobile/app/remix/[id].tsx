import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Link, Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { apiFetch } from "../../lib/api";
import { ArrowRight, ChevronLeft, Remix } from "../../lib/icons";

// The four remix lenses, mirroring the web `/remix/[id]` page + REMIX_AXES in @gm/core/recipe.
const AXES = [
  { key: "healthier", label: "Healthier" },
  { key: "cheaper", label: "Cheaper" },
  { key: "faster", label: "Faster" },
  { key: "vegan", label: "Vegan" },
] as const;
type Axis = (typeof AXES)[number]["key"];

type Swap = { original: string; replacement: string; reason: string };
type RemixResult = { axis: Axis; source: string; swaps: Swap[]; note: string };

// The remix endpoint returns a discriminated union (see app/api/mobile/recipes/[id]/remix): the
// remix itself, an upgrade prompt for free users, or a daily-AI-limit state.
type RemixResponse =
  | { title: string; axis: Axis; remix: RemixResult }
  | { upgradeRequired: true }
  | { quotaExceeded: true };

export default function RemixScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [axis, setAxis] = useState<Axis>("healthier");
  const [remix, setRemix] = useState<RemixResult | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  // Monotonic request id: rapid axis-tab switches fire overlapping fetches that can resolve out of
  // order, so only the LATEST request is allowed to commit state — an older one bails after its await.
  const reqGen = useRef(0);

  const load = useCallback(
    async (which: Axis) => {
      if (!token || !id) return;
      const gen = ++reqGen.current;
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/api/mobile/recipes/${id}/remix?axis=${which}`, token);
        if (!res.ok) throw new Error("fetch failed");
        const data = (await res.json()) as RemixResponse;
        if (gen !== reqGen.current) return; // superseded by a newer axis request
        if ("upgradeRequired" in data) {
          setUpgradeRequired(true);
          setRemix(null);
          return;
        }
        setUpgradeRequired(false);
        if ("quotaExceeded" in data) {
          setQuotaExceeded(true);
          setRemix(null);
          return;
        }
        setQuotaExceeded(false);
        setRemix(data.remix);
        setTitle(data.title);
      } catch {
        if (gen === reqGen.current) setError("Couldn't load this remix — check your connection.");
      } finally {
        if (gen === reqGen.current) setLoading(false);
      }
    },
    [token, id],
  );

  useEffect(() => { load(axis); }, [load, axis]);

  if (!token) return <Redirect href="/login" />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable
        onPress={() => router.push(`/cook/${id}`)}
        style={styles.backLink}
        accessibilityRole="button"
        accessibilityLabel="Back to recipe"
      >
        <ChevronLeft size={16} color="#0c8a3e" />
        <Text style={styles.backLinkText}>Back to recipe</Text>
      </Pressable>

      <View style={styles.header}>
        <View style={styles.headerMark}>
          <Remix size={20} color="#7c3aed" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Recipe remix</Text>
          <Text style={styles.title} numberOfLines={2}>{title ?? "Make it your way"}</Text>
        </View>
      </View>

      {/* Axis tabs — free to switch; each fetches its own remix. */}
      <View style={styles.tabs}>
        {AXES.map((a) => {
          const active = a.key === axis;
          return (
            <Pressable
              key={a.key}
              onPress={() => setAxis(a.key)}
              style={[styles.tab, active ? styles.tabActive : styles.tabIdle]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${a.label} remix`}
            >
              <Text style={[styles.tabText, active ? styles.tabTextActive : styles.tabTextIdle]}>
                {a.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color="#0c8a3e" />
          <Text style={styles.stateHint}>Finding smart swaps…</Text>
        </View>
      ) : error ? (
        <View style={styles.stateBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => load(axis)} accessibilityRole="button">
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : upgradeRequired ? (
        <View style={styles.stateBox}>
          <View style={styles.emptyMark}>
            <Remix size={22} color="#7c3aed" />
          </View>
          <Text style={styles.emptyTitle}>Premium feature</Text>
          <Text style={styles.emptyNote}>
            Upgrade to remix any recipe — healthier, cheaper, faster, or vegan swaps tailored to
            what you cook.
          </Text>
          <Link
            href="/upgrade"
            style={styles.upgradeBtn}
            accessibilityRole="button"
            accessibilityLabel="See plans"
          >
            <Text style={styles.upgradeBtnText}>See plans</Text>
          </Link>
        </View>
      ) : quotaExceeded ? (
        <View style={styles.stateBox}>
          <View style={styles.emptyMark}>
            <Remix size={22} color="#7c3aed" />
          </View>
          <Text style={styles.emptyTitle}>Daily AI limit reached</Text>
          <Text style={styles.emptyNote}>
            You've used today's AI remixes. Upgrade for more, or come back tomorrow.
          </Text>
        </View>
      ) : remix && remix.swaps.length === 0 ? (
        <View style={styles.stateBox}>
          <View style={styles.emptyMark}>
            <Remix size={22} color="#7c3aed" />
          </View>
          <Text style={styles.emptyTitle}>Nothing to swap</Text>
          <Text style={styles.emptyNote}>{remix.note}</Text>
        </View>
      ) : remix ? (
        <>
          <Text style={styles.note}>{remix.note}</Text>
          {remix.swaps.map((s, i) => (
            <View key={`${s.original}-${i}`} style={styles.swapCard}>
              <View style={styles.swapRow}>
                <Text style={styles.swapOriginal}>{s.original}</Text>
                <ArrowRight size={15} color="#a3acb5" />
                <Text style={styles.swapReplacement}>{s.replacement}</Text>
              </View>
              <Text style={styles.swapReason}>{s.reason}</Text>
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf8f3" },
  content: { padding: 20, paddingBottom: 48 },
  backLink: { flexDirection: "row", alignItems: "center", gap: 2, marginBottom: 12 },
  backLinkText: { fontSize: 14, color: "#0c8a3e", fontWeight: "500" },

  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
  headerMark: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#f3ecfe",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "600",
    color: "#7c3aed",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  title: { fontSize: 22, fontWeight: "700", color: "#1d2530", lineHeight: 28 },

  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  tab: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  tabActive: { backgroundColor: "#1d2530", borderColor: "#1d2530" },
  tabIdle: { backgroundColor: "#ffffff", borderColor: "#ece7dd" },
  tabText: { fontSize: 14, fontWeight: "600" },
  tabTextActive: { color: "#ffffff" },
  tabTextIdle: { color: "#525d6a" },

  stateBox: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 8 },
  stateHint: { marginTop: 14, fontSize: 14, color: "#525d6a" },
  errorText: { fontSize: 15, color: "#8e261b", textAlign: "center", marginBottom: 16 },
  retryBtn: { backgroundColor: "#0c8a3e", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 28 },
  retryBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "600" },

  emptyMark: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#f3ecfe",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#1d2530", marginBottom: 8 },
  emptyNote: {
    fontSize: 14,
    color: "#525d6a",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
    maxWidth: 300,
  },
  upgradeBtn: {
    backgroundColor: "#0c8a3e",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 28,
    color: "#ffffff",
  },
  upgradeBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "600" },

  note: {
    fontSize: 14,
    color: "#15803d",
    backgroundColor: "#f0faf4",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    padding: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  swapCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ece7dd",
    padding: 16,
    marginBottom: 10,
  },
  swapRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  swapOriginal: { fontSize: 15, color: "#8a94a0", fontWeight: "500", textDecorationLine: "line-through" },
  swapReplacement: { fontSize: 15, color: "#1d2530", fontWeight: "700" },
  swapReason: { fontSize: 13, color: "#525d6a", marginTop: 6, lineHeight: 18 },
});
