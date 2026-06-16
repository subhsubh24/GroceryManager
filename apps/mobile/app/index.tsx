// Home screen (skeleton). The whole point of the monorepo split is here: the UI is native, but the
// ENGINES come from packages/core — the same framework-agnostic, RN-portable logic the web app uses.
import { Link } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
// Pure, dependency-free helper shared with the web Cook Mode — proves packages/core is reusable as-is.
import { scaleMeasure } from "@gm/core/recipe";

export default function Home() {
  // Same cooking math the web uses — no reimplementation needed on native.
  const doubled = scaleMeasure("200g", 2); // → "400g"

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🧺</Text>
      <Text style={styles.title}>GroceryManager</Text>
      <Text style={styles.subtitle}>Your grocery + cooking autopilot — now native.</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Shared-core check</Text>
        <Text style={styles.cardValue}>scaleMeasure(&quot;200g&quot;, 2) = {doubled}</Text>
      </View>

      <Link href="/pantry" style={styles.link}>
        Open pantry →
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#faf8f3" },
  logo: { fontSize: 48 },
  title: { fontSize: 28, fontWeight: "700", color: "#1d2530", marginTop: 8 },
  subtitle: { fontSize: 15, color: "#525d6a", marginTop: 6, textAlign: "center" },
  card: { marginTop: 24, padding: 16, borderRadius: 16, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#ece7dd" },
  cardLabel: { fontSize: 12, fontWeight: "600", color: "#0c8a3e", textTransform: "uppercase", letterSpacing: 1 },
  cardValue: { fontSize: 16, color: "#1d2530", marginTop: 4 },
  link: { marginTop: 24, fontSize: 16, fontWeight: "600", color: "#0a6e33" },
});
