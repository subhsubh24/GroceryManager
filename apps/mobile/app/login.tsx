import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../lib/auth";

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await login(username.trim(), password);
    setLoading(false);
    if (result.ok) {
      router.replace("/");
    } else {
      setError(result.error ?? "Login failed.");
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.logoMark}>
        <Text style={styles.logoGlyph}>GM</Text>
      </View>
      <Text style={styles.title}>GroceryManager</Text>
      <Text style={styles.subtitle}>Sign in to your account</Text>

      <View style={styles.form}>
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          accessibilityLabel="Username"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="your_username"
          placeholderTextColor="#a3acb5"
          returnKeyType="next"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          accessibilityLabel="Password"
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor="#a3acb5"
          returnKeyType="done"
          onSubmitEditing={handleLogin}
        />

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#faf8f3",
  },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#0c8a3e",
    alignItems: "center",
    justifyContent: "center",
  },
  logoGlyph: { color: "#ffffff", fontSize: 24, fontWeight: "800" },
  title: { fontSize: 26, fontWeight: "700", color: "#1d2530", marginTop: 12 },
  subtitle: { fontSize: 15, color: "#525d6a", marginTop: 4, marginBottom: 32 },
  form: { width: "100%", maxWidth: 360 },
  errorBox: {
    backgroundColor: "#fdecea",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e8a09a",
  },
  errorText: { color: "#8e261b", fontSize: 14 },
  label: { fontSize: 13, fontWeight: "600", color: "#2b333d", marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#d1cfc9",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: "#ffffff",
    color: "#1d2530",
  },
  button: {
    backgroundColor: "#0c8a3e",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 28,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
});
