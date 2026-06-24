import { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { isAuthenticated } from "./lib/api";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/signin");
    }
  }, [router]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>GroceryManager</Text>
      <Text style={styles.title}>Good evening</Text>
      <Text style={styles.subtitle}>Here&apos;s what&apos;s going on in your kitchen.</Text>

      <View style={styles.grid}>
        <TouchableOpacity style={styles.card} onPress={() => router.push("/pantry")} activeOpacity={0.7}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>P</Text>
          </View>
          <Text style={styles.cardTitle}>Pantry</Text>
          <Text style={styles.cardSub}>What&apos;s in stock</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => router.push("/list")} activeOpacity={0.7}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>S</Text>
          </View>
          <Text style={styles.cardTitle}>Shopping list</Text>
          <Text style={styles.cardSub}>What to buy</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf8f3" },
  content: { padding: 24, paddingTop: 60 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: "#0c8a3e",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: { fontSize: 28, fontWeight: "700", color: "#1d2530", marginBottom: 4 },
  subtitle: { fontSize: 15, color: "#525d6a", marginBottom: 24 },
  grid: { gap: 12 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#ece7dd",
    marginBottom: 4,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0c8a3e",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  iconText: { fontSize: 18, fontWeight: "700", color: "#ffffff" },
  cardTitle: { fontSize: 17, fontWeight: "600", color: "#1d2530" },
  cardSub: { fontSize: 13, color: "#525d6a", marginTop: 2 },
});
