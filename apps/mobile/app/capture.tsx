import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";

export default function CaptureScreen() {
  const { token } = useAuth();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!token) return <Redirect href="/login" />;

  async function submit() {
    if (!text.trim()) return;
    setLoading(true);
    setAdded(null);
    setError(null);
    try {
      const res = await apiFetch("/api/mobile/capture", token!, {
        method: "POST",
        body: JSON.stringify({ text: text.trim() }),
      });
      if (!res.ok) {
        setError("Couldn't add items — try again.");
        return;
      }
      const data = (await res.json()) as { added: number };
      setAdded(data.added);
      setText("");
    } catch {
      setError("Network error — check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Quick add</Text>
        <Text style={styles.hint}>
          Type it like you'd say it — "we're out of milk and need taco stuff." We'll sort it onto
          your list.
        </Text>

        <TextInput
          style={styles.input}
          multiline
          numberOfLines={4}
          accessibilityLabel="Quick add — describe what you need"
          placeholder="we're out of milk and need taco stuff…"
          placeholderTextColor="#a3acb5"
          value={text}
          onChangeText={setText}
          textAlignVertical="top"
        />

        {added !== null ? (
          <View style={styles.successRow}>
            <Text style={styles.successText}>
              {added === 0
                ? "Nothing recognized — check your text."
                : `Added ${added} item${added === 1 ? "" : "s"} to your list.`}
            </Text>
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          style={[styles.button, (!text.trim() || loading) && styles.buttonDisabled]}
          onPress={submit}
          disabled={!text.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Add to list</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#faf8f3" },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: "700", color: "#1d2530", marginBottom: 6 },
  hint: { fontSize: 14, color: "#525d6a", lineHeight: 20, marginBottom: 20 },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#ece7dd",
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    color: "#1d2530",
    minHeight: 100,
    lineHeight: 22,
  },
  successRow: {
    marginTop: 12,
    backgroundColor: "#f0faf4",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  successText: { fontSize: 14, color: "#15803d", fontWeight: "500" },
  errorText: { fontSize: 14, color: "#8e261b", marginTop: 10 },
  button: {
    marginTop: 16,
    backgroundColor: "#0c8a3e",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontSize: 16, fontWeight: "700", color: "#ffffff" },
});
