import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { Redirect, Link } from "expo-router";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";

interface ProfileData {
  name: string | null;
  email: string | null;
  username: string | null;
  // Mirror @gm/core/billing SubscriptionTier — the /api/mobile/profile route returns the full union
  // (incl. premium_family), so every member MUST have a label below or a Family subscriber sees the
  // raw slug. Typed as Record<tier, string> so the mobile typecheck job fails if a tier is unlabeled.
  tier: "free" | "premium_monthly" | "premium_annual" | "premium_family";
}

const TIER_LABEL: Record<ProfileData["tier"], string> = {
  free: "Free",
  premium_monthly: "Premium (monthly)",
  premium_annual: "Premium (annual)",
  premium_family: "Premium (family)",
};

export default function ProfileScreen() {
  const { token, logout } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  if (!token) return <Redirect href="/login" />;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/mobile/profile", token!);
      if (!res.ok) {
        setError("Couldn't load profile.");
        return;
      }
      const data = (await res.json()) as ProfileData;
      setProfile(data);
    } catch {
      setError("Network error — check your connection.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDeleteAccount() {
    if (deleteConfirm.trim().toLowerCase() !== "delete") {
      Alert.alert("Type 'delete' to confirm.");
      return;
    }
    setDeleting(true);
    try {
      const res = await apiFetch("/api/mobile/account", token!, {
        method: "DELETE",
        body: JSON.stringify({ confirm: "delete" }),
      });
      if (res.ok) {
        setDeleteModalVisible(false);
        logout();
      } else {
        setDeleteConfirm("");
        Alert.alert("Couldn't delete account — try again.");
      }
    } catch {
      setDeleteConfirm("");
      Alert.alert("Network error — try again.");
    } finally {
      setDeleting(false);
    }
  }

  const tierLabel = profile ? (TIER_LABEL[profile.tier] ?? profile.tier) : "";
  const isPremium = profile?.tier !== "free";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Profile & Settings</Text>

      {loading ? (
        <ActivityIndicator color="#0c8a3e" style={styles.loader} />
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : profile ? (
        <>
          <View style={styles.card}>
            <View style={styles.avatarMark}>
              <Text style={styles.avatarGlyph}>
                {(profile.name ?? profile.username ?? "U").slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.displayName}>{profile.name ?? profile.username ?? "You"}</Text>
            {profile.email ? <Text style={styles.meta}>{profile.email}</Text> : null}
            {profile.username ? <Text style={styles.meta}>@{profile.username}</Text> : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Subscription</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Plan</Text>
              <Text style={[styles.rowValue, isPremium && styles.premiumBadge]}>{tierLabel}</Text>
            </View>
            {!isPremium && (
              <Link
                href="/upgrade"
                style={styles.upgradeLink}
                accessibilityRole="button"
                accessibilityLabel="Upgrade to Premium"
              >
                <Text style={styles.upgradeLinkText}>Upgrade to Premium →</Text>
              </Link>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <Pressable style={styles.actionRow} onPress={logout}>
              <Text style={styles.actionLabel}>Sign out</Text>
            </Pressable>
            <Pressable
              style={[styles.actionRow, styles.dangerRow]}
              onPress={() => setDeleteModalVisible(true)}
            >
              <Text style={styles.dangerLabel}>Delete account…</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Delete account?</Text>
            <Text style={styles.dialogBody}>
              This permanently erases your pantry, recipes, shopping list, and all data. This
              cannot be undone.
            </Text>
            <Text style={styles.dialogLabel}>Type "delete" to confirm</Text>
            <TextInput
              style={styles.dialogInput}
              value={deleteConfirm}
              onChangeText={setDeleteConfirm}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel='Type "delete" to confirm account deletion'
              placeholder="delete"
              placeholderTextColor="#a3acb5"
            />
            <View style={styles.dialogActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => {
                  setDeleteModalVisible(false);
                  setDeleteConfirm("");
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.deleteBtn, deleting && styles.deleteBtnDisabled]}
                onPress={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.deleteText}>Delete account</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf8f3" },
  content: { padding: 20, paddingBottom: 48 },
  heading: { fontSize: 26, fontWeight: "700", color: "#1d2530", marginBottom: 24 },
  loader: { marginTop: 48 },
  errorBox: {
    backgroundColor: "#fdecea",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e8a09a",
  },
  errorText: { color: "#8e261b", fontSize: 14 },
  retryBtn: { marginTop: 10 },
  retryText: { color: "#0c8a3e", fontWeight: "600" },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#ece7dd",
    alignItems: "center",
    marginBottom: 20,
  },
  avatarMark: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#0c8a3e",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarGlyph: { color: "#ffffff", fontSize: 28, fontWeight: "700" },
  displayName: { fontSize: 20, fontWeight: "700", color: "#1d2530" },
  meta: { fontSize: 14, color: "#525d6a", marginTop: 2 },

  section: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ece7dd",
    marginBottom: 16,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#a3acb5",
    letterSpacing: 0.5,
    padding: 16,
    paddingBottom: 8,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#f5f2ec",
  },
  rowLabel: { fontSize: 15, color: "#1d2530" },
  rowValue: { fontSize: 15, color: "#525d6a" },
  premiumBadge: { color: "#0c8a3e", fontWeight: "700" },
  upgradeLink: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#f5f2ec",
  },
  upgradeLinkText: { fontSize: 15, color: "#0c8a3e", fontWeight: "600" },

  actionRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#f5f2ec",
  },
  actionLabel: { fontSize: 15, color: "#1d2530" },
  dangerRow: {},
  dangerLabel: { fontSize: 15, color: "#c0392b" },

  // Delete modal
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  dialog: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 24,
    width: "100%",
    maxWidth: 360,
  },
  dialogTitle: { fontSize: 18, fontWeight: "700", color: "#c0392b", marginBottom: 10 },
  dialogBody: { fontSize: 14, color: "#525d6a", lineHeight: 20, marginBottom: 20 },
  dialogLabel: { fontSize: 13, fontWeight: "600", color: "#2b333d", marginBottom: 6 },
  dialogInput: {
    borderWidth: 1,
    borderColor: "#e8a09a",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: "#1d2530",
    backgroundColor: "#fdecea",
  },
  dialogActions: { flexDirection: "row", gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#f5f2ec",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelText: { fontSize: 15, fontWeight: "600", color: "#525d6a" },
  deleteBtn: {
    flex: 1,
    backgroundColor: "#c0392b",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  deleteBtnDisabled: { opacity: 0.6 },
  deleteText: { fontSize: 15, fontWeight: "700", color: "#ffffff" },
});
