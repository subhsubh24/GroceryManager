// Pantry screen (skeleton). In the real app this reads the user's pantry from the API (the same
// depletion/confidence engine the web uses lives in packages/core) and renders it natively.
import { View, Text, StyleSheet } from "react-native";

export default function Pantry() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pantry</Text>
      <Text style={styles.note}>
        Skeleton screen. Wire this to the GroceryManager API and reuse the pantry/depletion logic from
        packages/core (see README).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#faf8f3" },
  title: { fontSize: 24, fontWeight: "700", color: "#1d2530" },
  note: { fontSize: 15, color: "#525d6a", marginTop: 8, lineHeight: 22 },
});
