import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { api, setToken } from "./lib/api";

export default function SignIn() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    if (!username.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      const token = await api.signIn(username.trim(), password);
      setToken(token);
      router.replace("/");
    } catch {
      setError("Couldn't sign in — check your username and password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>GroceryManager</Text>
        <Text style={styles.sub}>Sign in to your account</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          placeholder="your username"
          placeholderTextColor="#52596a"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          returnKeyType="go"
          onSubmitEditing={handleSignIn}
          placeholder="••••••••"
          placeholderTextColor="#52596a"
        />

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleSignIn}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Sign in</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf8f3" },
  content: { flex: 1, justifyContent: "center", padding: 24 },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1d2530",
    marginBottom: 6,
    textAlign: "center",
  },
  sub: { fontSize: 15, color: "#525d6a", textAlign: "center", marginBottom: 32 },
  label: { fontSize: 13, fontWeight: "600", color: "#2b333d", marginBottom: 6 },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: "#ece7dd",
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#1d2530",
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  btn: {
    height: 52,
    backgroundColor: "#0c8a3e",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: {
    backgroundColor: "#fdeceb",
    color: "#8e261b",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 14,
  },
});
