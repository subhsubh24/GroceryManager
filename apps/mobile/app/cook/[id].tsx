import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  Image,
} from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { apiFetch } from "../../lib/api";

type Recipe = {
  id: string;
  title: string;
  imageUrl?: string;
  instructions?: string;
  sourceUrl?: string;
  cuisine?: string;
  ingredients: { name: string; measure?: string }[];
};

export default function CookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  if (!token) return <Redirect href="/login" />;

  // "I cooked this" — logs the meal + draws down the pantry via the same core path the web uses.
  // Awaits + checks the server result before flipping to the "Logged" state (no optimistic success).
  async function logCooked() {
    if (!token || !id || logging || logged) return;
    setLogging(true);
    setLogError(null);
    try {
      const res = await apiFetch("/api/mobile/cook", token, {
        method: "POST",
        body: JSON.stringify({ recipeId: id }),
      });
      if (res.ok) {
        setLogged(true);
      } else {
        setLogError("Couldn't log this cook — please try again.");
      }
    } catch {
      setLogError("Network error — check your connection and try again.");
    } finally {
      setLogging(false);
    }
  }

  useEffect(() => {
    if (!token || !id) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/api/mobile/recipes/${id}`, token!);
        if (!res.ok) {
          setError("Couldn't load this recipe.");
          return;
        }
        const data = (await res.json()) as { recipe: Recipe };
        if (!cancelled) setRecipe(data.recipe);
      } catch {
        if (!cancelled) setError("Network error — check your connection.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token, id]);

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
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </View>
    );
  }

  const steps = recipe.instructions
    ? recipe.instructions
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const isLastStep = step >= steps.length - 1;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.backLink}>
        <Text style={styles.backLinkText}>← Recipes</Text>
      </Pressable>

      {recipe.imageUrl ? (
        <Image source={{ uri: recipe.imageUrl }} style={styles.hero} resizeMode="cover" />
      ) : null}

      <Text style={styles.eyebrow}>Cook mode</Text>
      <Text style={styles.title}>{recipe.title}</Text>
      {recipe.cuisine ? <Text style={styles.cuisine}>{recipe.cuisine}</Text> : null}

      {/* One-tap "I cooked this" — logs the meal + macros and draws down the pantry. */}
      <Pressable
        style={[styles.cookedBtn, (logging || logged) && styles.cookedBtnDone]}
        onPress={logCooked}
        disabled={logging || logged}
        accessibilityRole="button"
        accessibilityLabel={logged ? "Logged" : "I cooked this"}
      >
        {logging ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={styles.cookedBtnText}>{logged ? "Logged ✓" : "I cooked this"}</Text>
        )}
      </Pressable>
      {logged ? (
        <Pressable onPress={() => router.push("/cooked")} accessibilityRole="button">
          <Text style={styles.cookedLink}>View cooked meals →</Text>
        </Pressable>
      ) : null}
      {logError ? <Text style={styles.cookedError}>{logError}</Text> : null}

      {/* Ingredients */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ingredients</Text>
        {recipe.ingredients.map((ing, i) => (
          <View key={i} style={styles.ingredientRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.ingredientText}>
              {ing.measure ? `${ing.measure} ` : ""}
              {ing.name}
            </Text>
          </View>
        ))}
      </View>

      {/* Step-through cook mode */}
      {steps.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Step {step + 1} of {steps.length}
          </Text>
          <View style={styles.stepCard}>
            <Text style={styles.stepText}>{steps[step]}</Text>
          </View>
          <View style={styles.stepNav}>
            <Pressable
              style={[styles.navBtn, step === 0 && styles.navBtnDisabled]}
              onPress={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              <Text style={[styles.navBtnText, step === 0 && styles.navBtnTextDisabled]}>
                ← Prev
              </Text>
            </Pressable>
            <Pressable
              style={[styles.navBtn, styles.navBtnPrimary]}
              onPress={() => {
                if (isLastStep) {
                  setStep(0);
                } else {
                  setStep((s) => s + 1);
                }
              }}
            >
              <Text style={styles.navBtnTextPrimary}>
                {isLastStep ? "Start over" : "Next →"}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf8f3" },
  content: { padding: 20, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  backLink: { marginBottom: 12 },
  backLinkText: { fontSize: 14, color: "#0c8a3e", fontWeight: "500" },
  hero: { width: "100%", height: 220, borderRadius: 16, marginBottom: 16 },
  eyebrow: { fontSize: 11, fontWeight: "600", color: "#0c8a3e", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 },
  title: { fontSize: 24, fontWeight: "700", color: "#1d2530", lineHeight: 30 },
  cuisine: { fontSize: 13, color: "#525d6a", marginTop: 4 },
  cookedBtn: {
    marginTop: 16,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#0c8a3e",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  cookedBtnDone: { backgroundColor: "#0a6e33" },
  cookedBtnText: { fontSize: 16, fontWeight: "700", color: "#ffffff" },
  cookedLink: { marginTop: 10, fontSize: 14, fontWeight: "600", color: "#0c8a3e", textAlign: "center" },
  cookedError: { marginTop: 10, fontSize: 13, color: "#8e261b", textAlign: "center" },
  section: {
    marginTop: 24,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ece7dd",
    padding: 16,
  },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#1d2530", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  ingredientRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  bullet: { fontSize: 15, color: "#0c8a3e", marginRight: 8, lineHeight: 22 },
  ingredientText: { flex: 1, fontSize: 15, color: "#1d2530", lineHeight: 22 },
  stepCard: {
    backgroundColor: "#faf8f3",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  stepText: { fontSize: 16, color: "#1d2530", lineHeight: 24 },
  stepNav: { flexDirection: "row", gap: 10 },
  navBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ece7dd",
  },
  navBtnDisabled: { opacity: 0.35 },
  navBtnPrimary: { backgroundColor: "#0c8a3e", borderColor: "#0c8a3e" },
  navBtnText: { fontSize: 15, fontWeight: "600", color: "#525d6a" },
  navBtnTextDisabled: { color: "#c8c1b8" },
  navBtnTextPrimary: { fontSize: 15, fontWeight: "600", color: "#ffffff" },
  errorText: { fontSize: 15, color: "#8e261b", textAlign: "center", marginBottom: 16 },
  backButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: "#0c8a3e",
    borderRadius: 10,
  },
  backText: { color: "#ffffff", fontWeight: "600" },
});
