import { Link, Redirect } from "expo-router";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useAuth } from "../lib/auth";

export default function HomeScreen() {
  const { token, userName, logout } = useAuth();

  if (!token) return <Redirect href="/login" />;

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🧺</Text>
      <Text style={styles.title}>GroceryManager</Text>
      <Text style={styles.subtitle}>
        {userName ? `Welcome back, ${userName}` : "Your grocery + cooking autopilot"}
      </Text>

      <View style={styles.nav}>
        <Link href="/pantry" style={styles.card}>
          <Text style={styles.cardLabel}>Pantry →</Text>
          <Text style={styles.cardNote}>What you have at home</Text>
        </Link>
        <Link href="/list" style={styles.card}>
          <Text style={styles.cardLabel}>Shopping list →</Text>
          <Text style={styles.cardNote}>What to pick up next</Text>
        </Link>
      </View>

      <Pressable style={styles.signOut} onPress={logout}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
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
  logo: { fontSize: 48 },
  title: { fontSize: 28, fontWeight: "700", color: "#1d2530", marginTop: 8 },
  subtitle: { fontSize: 15, color: "#525d6a", marginTop: 6, textAlign: "center", marginBottom: 32 },
  nav: { width: "100%", gap: 12 },
  card: {
    display: "flex",
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#ece7dd",
    marginBottom: 12,
  },
  cardLabel: { fontSize: 16, fontWeight: "700", color: "#0c8a3e" },
  cardNote: { fontSize: 13, color: "#525d6a", marginTop: 2 },
  signOut: { marginTop: 32 },
  signOutText: { fontSize: 14, color: "#9ba8b4" },
});
