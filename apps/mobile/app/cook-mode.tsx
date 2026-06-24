import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  Alert,
} from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";

type Ingredient = { name: string; measure?: string };

type Recipe = {
  id: string;
  title: string;
  cuisine?: string;
  instructions?: string;
  ingredients: Ingredient[];
};

function splitSteps(instructions: string): string[] {
  // Split on numbered list (1. 2. etc) or double-newline
  const byNumber = instructions.split(/\n+\d+\.\s+/).filter(Boolean);
  if (byNumber.length > 1) return byNumber.map((s) => s.trim());
  return instructions
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function CookModeScreen() {
  const { token } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [logging, setLogging] = useState(false);

  if (!token) return <Redirect href="/login" />;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    apiFetch(`/api/mobile/recipes/${id}`, token!)
      .then(async (res) => {
        if (!res.ok) { if (!cancelled) setError("Recipe not found."); return; }
        const data = (await res.json()) as { recipe: Recipe };
        if (!cancelled) setRecipe(data.recipe);
      })
      .catch(() => { if (!cancelled) setError("Network error — check your connection."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, token]);

  function cooked() {
    if (!recipe || logging) return;
    setLogging(true);
    apiFetch("/api/mobile/cook", token!, {
      method: "POST",
      body: JSON.stringify({ recipeId: recipe.id, servings: 1 }),
    })
      .then(async (res) => {
        if (!res.ok) {
          Alert.alert("Error", "Could not log cook. Please try again.");
          return;
        }
        Alert.alert("Logged!", `${recipe.title} added to your cook history and pantry updated.`, [
          { text: "Done", onPress: () => router.back() },
        ]);
      })
      .catch(() => Alert.alert("Error", "Network error. Please try again."))
      .finally(() => setLogging(false));
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0c8a3e" />
      </View>
    );
  }

  if (error || !recipe) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? "Recipe not found."}</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const steps = recipe.instructions ? splitSteps(recipe.instructions) : [];
  const currentStep = steps[step];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.backLink}>
        <Text style={styles.backLinkText}>← Cookbook</Text>
      </Pressable>

      <Text style={styles.title}>{recipe.title}</Text>
      {recipe.cuisine ? <Text style={styles.cuisine}>{recipe.cuisine}</Text> : null}

      {/* Ingredients */}
      <Text style={styles.sectionHead}>Ingredients</Text>
      {recipe.ingredients.map((ing, i) => (
        <View key={i} style={styles.ingRow}>
          <View style={styles.dot} />
          <Text style={styles.ingText}>
            {ing.measure ? <Text style={styles.measure}>{ing.measure} </Text> : null}
            {ing.name}
          </Text>
        </View>
      ))}

      {/* Steps */}
      {steps.length > 0 ? (
        <>
          <Text style={styles.sectionHead}>
            Step {step + 1} of {steps.length}
          </Text>
          <View style={styles.stepCard}>
            <Text style={styles.stepText}>{currentStep}</Text>
          </View>
          <View style={styles.stepNav}>
            <Pressable
              style={[styles.navBtn, step === 0 && styles.navBtnDisabled]}
              onPress={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              <Text style={styles.navBtnText}>← Prev</Text>
            </Pressable>
            {step < steps.length - 1 ? (
              <Pressable style={styles.navBtn} onPress={() => setStep((s) => s + 1)}>
                <Text style={styles.navBtnText}>Next →</Text>
              </Pressable>
            ) : (
              <Pressable style={[styles.navBtn, styles.cookBtn]} onPress={cooked} disabled={logging}>
                <Text style={styles.cookBtnText}>{logging ? "Logging…" : "Cooked it! ✓"}</Text>
              </Pressable>
            )}
          </View>
        </>
      ) : (
        <Pressable style={[styles.navBtn, styles.cookBtn, { marginTop: 24 }]} onPress={cooked} disabled={logging}>
          <Text style={styles.cookBtnText}>{logging ? "Logging…" : "Cooked it! ✓"}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf8f3" },
  content: { padding: 20, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  backLink: { marginBottom: 16 },
  backLinkText: { fontSize: 14, color: "#0c8a3e", fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "700", color: "#1d2530", marginBottom: 4 },
  cuisine: { fontSize: 13, color: "#525d6a", marginBottom: 16 },
  sectionHead: { fontSize: 14, fontWeight: "700", color: "#525d6a", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 20, marginBottom: 10 },
  ingRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#0c8a3e", marginTop: 6 },
  ingText: { flex: 1, fontSize: 14, color: "#1d2530" },
  measure: { color: "#525d6a" },
  stepCard: { backgroundColor: "#ffffff", borderRadius: 14, padding: 18, borderWidth: 1, borderColor: "#ece7dd", marginBottom: 16 },
  stepText: { fontSize: 15, color: "#1d2530", lineHeight: 22 },
  stepNav: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  navBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: "#ece7dd", backgroundColor: "#ffffff", alignItems: "center" },
  navBtnDisabled: { opacity: 0.35 },
  navBtnText: { fontSize: 14, fontWeight: "600", color: "#1d2530" },
  cookBtn: { backgroundColor: "#0c8a3e", borderColor: "#0c8a3e" },
  cookBtnText: { fontSize: 14, fontWeight: "700", color: "#ffffff" },
  errorText: { fontSize: 15, color: "#c0392b", textAlign: "center" },
  backBtn: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 24, backgroundColor: "#0c8a3e", borderRadius: 10 },
  backBtnText: { color: "#ffffff", fontWeight: "600" },
});
