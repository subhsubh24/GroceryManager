import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Link, Redirect, router } from "expo-router";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";

interface DeckCard {
  id: string;
  title: string;
  imageUrl: string | null;
  cuisine: string | null;
  haveCount: number;
}

// The discover endpoint returns a discriminated union: a recipe deck, or an upgrade prompt for
// free users (Discover is a premium feature — see app/api/mobile/discover/route.ts).
type DiscoverResponse = { recipes: DeckCard[] } | { upgradeRequired: true };

export default function DiscoverScreen() {
  const { token } = useAuth();
  const [deck, setDeck] = useState<DeckCard[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [swiping, setSwiping] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/mobile/discover", token);
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json()) as DiscoverResponse;
      if ("upgradeRequired" in data && data.upgradeRequired) {
        // Free user — surface the paywall instead of a misleading "all caught up" empty state.
        setUpgradeRequired(true);
        setDeck([]);
        setIndex(0);
        return;
      }
      setUpgradeRequired(false);
      setDeck(("recipes" in data ? data.recipes : undefined) ?? []);
      setIndex(0);
    } catch {
      setError("Couldn't load recipes — check your connection.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (!token) return <Redirect href="/login" />;

  async function swipe(dir: "like" | "skip") {
    const card = deck[index];
    if (!card || swiping || !token) return;
    setSwiping(true);
    try {
      await apiFetch("/api/mobile/discover", token, {
        method: "POST",
        body: JSON.stringify({ recipeId: card.id, cuisine: card.cuisine, dir }),
      });
    } catch {
      // best-effort — signal loss is recoverable
    } finally {
      setSwiping(false);
    }
    const next = index + 1;
    if (next >= deck.length) {
      // Deck exhausted — reload a fresh batch
      load();
    } else {
      setIndex(next);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0c8a3e" />
        <Text style={styles.loadingText}>Finding recipes for you…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (upgradeRequired) {
    return (
      <View style={styles.center}>
        <View style={styles.emptyMark}>
          <Text style={styles.emptyGlyph}>GM</Text>
        </View>
        <Text style={styles.emptyTitle}>Premium feature</Text>
        <Text style={styles.emptyNote}>
          Upgrade to unlock unlimited Discover — swipe through recipes matched to what's in your
          pantry and train your taste.
        </Text>
        <Link
          href="/upgrade"
          style={styles.upgradeBtn}
          accessibilityRole="button"
          accessibilityLabel="See plans"
        >
          <Text style={styles.upgradeBtnText}>See plans →</Text>
        </Link>
      </View>
    );
  }

  const card = deck[index];

  if (!card) {
    return (
      <View style={styles.center}>
        <View style={styles.emptyMark}>
          <Text style={styles.emptyGlyph}>GM</Text>
        </View>
        <Text style={styles.emptyTitle}>All caught up</Text>
        <Text style={styles.emptyNote}>
          Add more items to your pantry to unlock a wider feed — we find recipes from what you
          have.
        </Text>
        <Pressable style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryBtnText}>Refresh</Text>
        </Pressable>
      </View>
    );
  }

  const remaining = deck.length - index;

  return (
    <View style={styles.container}>
      {/* Progress pill */}
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          {index + 1} / {deck.length}
        </Text>
        <Text style={styles.progressHint}>Like or skip to train your taste</Text>
      </View>

      {/* Card stack hint — ghost card behind */}
      {remaining > 1 && (
        <View style={[styles.card, styles.cardGhost]} pointerEvents="none" />
      )}

      {/* Main card */}
      <View style={styles.card}>
        {card.imageUrl?.startsWith("https://") ? (
          <Image source={{ uri: card.imageUrl }} style={styles.cardImg} />
        ) : (
          <View style={styles.cardImgPlaceholder}>
            <Text style={styles.cardImgLetter}>
              {(card.title ?? "R").charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>{card.title}</Text>
          {card.cuisine ? (
            <Text style={styles.cardCuisine}>{card.cuisine}</Text>
          ) : null}
          {card.haveCount > 0 ? (
            <View style={styles.haveChip}>
              <Text style={styles.haveChipText}>
                {card.haveCount} ingredient{card.haveCount === 1 ? "" : "s"} in pantry
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.actionBtn, styles.skipBtn, swiping && styles.actionBtnDisabled]}
          onPress={() => swipe("skip")}
          disabled={swiping}
        >
          <Text style={styles.skipBtnText}>Skip</Text>
        </Pressable>

        <Pressable
          style={[styles.actionBtn, styles.likeBtn, swiping && styles.actionBtnDisabled]}
          onPress={() => swipe("like")}
          disabled={swiping}
        >
          {swiping ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.likeBtnText}>Like</Text>
          )}
        </Pressable>
      </View>

      {/* Cook this recipe */}
      <Pressable
        style={styles.cookLink}
        onPress={() => router.push(`/cook/${card.id}`)}
      >
        <Text style={styles.cookLinkText}>Cook this recipe →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#faf8f3",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#faf8f3",
  },
  loadingText: { marginTop: 14, fontSize: 14, color: "#525d6a" },

  errorText: { fontSize: 15, color: "#c0392b", textAlign: "center", marginBottom: 16 },
  retryBtn: {
    backgroundColor: "#0c8a3e",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 28,
  },
  retryBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "600" },

  upgradeBtn: {
    backgroundColor: "#0c8a3e",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 28,
    color: "#ffffff",
  },
  upgradeBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "600" },

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

  progressRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  progressText: { fontSize: 13, fontWeight: "700", color: "#1d2530" },
  progressHint: { fontSize: 12, color: "#a3acb5" },

  cardGhost: {
    position: "absolute",
    top: 58,
    transform: [{ scale: 0.96 }],
    opacity: 0.5,
  },
  card: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ece7dd",
    overflow: "hidden",
    marginBottom: 20,
  },
  cardImg: { width: "100%", height: 220 },
  cardImgPlaceholder: {
    width: "100%",
    height: 220,
    backgroundColor: "#f0faf4",
    alignItems: "center",
    justifyContent: "center",
  },
  cardImgLetter: { fontSize: 56, fontWeight: "800", color: "#0c8a3e" },
  cardBody: { padding: 18 },
  cardTitle: { fontSize: 20, fontWeight: "700", color: "#1d2530", lineHeight: 26 },
  cardCuisine: { fontSize: 13, color: "#0c8a3e", fontWeight: "600", marginTop: 4 },
  haveChip: {
    alignSelf: "flex-start",
    marginTop: 10,
    backgroundColor: "#f0faf4",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  haveChipText: { fontSize: 12, color: "#15803d", fontWeight: "600" },

  actions: {
    width: "100%",
    flexDirection: "row",
    gap: 14,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnDisabled: { opacity: 0.5 },
  skipBtn: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#ece7dd" },
  skipBtnText: { fontSize: 17, fontWeight: "700", color: "#525d6a" },
  likeBtn: { backgroundColor: "#0c8a3e" },
  likeBtnText: { fontSize: 17, fontWeight: "700", color: "#ffffff" },

  cookLink: { paddingVertical: 8 },
  cookLinkText: { fontSize: 14, color: "#0c8a3e", fontWeight: "600" },
});
