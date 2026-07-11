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
import { ArrowLeft, ArrowRight, Check, ChevronLeft } from "../../lib/icons";

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
  const [servings, setServings] = useState(1);

  if (!token) return <Redirect href="/login" />;

  // "I cooked this" — logs the meal + draws down the pantry via the same core path the web uses.
  // Awaits + checks the server result before flipping to the "Logged" state (no optimistic success).
  // Sends the chosen servings so a batch cook draws down + counts macros for the real amount.
  async function logCooked() {
    if (!token || !id || logging || logged) return;
    setLogging(true);
    setLogError(null);
    try {
      const res = await apiFetch("/api/mobile/cook", token, {
        method: "POST",
        body: JSON.stringify({ recipeId: id, servings }),
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
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={16} color="#ffffff" />
          <Text style={styles.backText}>Back</Text>
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
      <Pressable
        onPress={() => router.back()}
        style={styles.backLink}
        accessibilityRole="button"
        accessibilityLabel="Back to recipes"
      >
        <ChevronLeft size={16} color="#0c8a3e" />
        <Text style={styles.backLinkText}>Recipes</Text>
      </Pressable>

      {recipe.imageUrl ? (
        <Image source={{ uri: recipe.imageUrl }} style={styles.hero} resizeMode="cover" />
      ) : null}

      <Text style={styles.eyebrow}>Cook mode</Text>
      <Text style={styles.title}>{recipe.title}</Text>
      {recipe.cuisine ? <Text style={styles.cuisine}>{recipe.cuisine}</Text> : null}

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
              accessibilityRole="button"
              accessibilityLabel="Previous step"
            >
              <ArrowLeft size={16} color={step === 0 ? "#c8c1b8" : "#525d6a"} />
              <Text style={[styles.navBtnText, step === 0 && styles.navBtnTextDisabled]}>
                Prev
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
              accessibilityRole="button"
              accessibilityLabel={isLastStep ? "Start over" : "Next step"}
            >
              <Text style={styles.navBtnTextPrimary}>
                {isLastStep ? "Start over" : "Next"}
              </Text>
              {!isLastStep ? <ArrowRight size={16} color="#ffffff" /> : null}
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* "Made it?" — the logger sits at the BOTTOM (after ingredients + the step-through) so it's a
          deliberate end-of-cook action, matching web's placement. Logging draws down the pantry
          ledger + records a meal, so it's gated behind moving through the recipe, not a reflexive tap. */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Made it?</Text>
        <Text style={styles.madeItHint}>
          {steps.length > 0 && isLastStep
            ? "Last step done — log it to draw down what you used and count the macros."
            : "Logs the meal, learns your taste, and draws down what you used."}
        </Text>

        {!logged ? (
          <View style={styles.servingsRow}>
            <Text style={styles.servingsLabel}>Servings</Text>
            <View style={styles.stepper}>
              <Pressable
                style={[styles.stepperBtn, servings <= 1 && styles.stepperBtnDisabled]}
                onPress={() => setServings((s) => Math.max(1, s - 1))}
                disabled={servings <= 1}
                accessibilityRole="button"
                accessibilityLabel="Fewer servings"
              >
                <Text style={styles.stepperBtnText}>−</Text>
              </Pressable>
              <Text style={styles.stepperValue}>{servings}</Text>
              <Pressable
                style={[styles.stepperBtn, servings >= 12 && styles.stepperBtnDisabled]}
                onPress={() => setServings((s) => Math.min(12, s + 1))}
                disabled={servings >= 12}
                accessibilityRole="button"
                accessibilityLabel="More servings"
              >
                <Text style={styles.stepperBtnText}>+</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Pressable
          style={[styles.cookedBtn, (logging || logged) && styles.cookedBtnDone]}
          onPress={logCooked}
          disabled={logging || logged}
          accessibilityRole="button"
          accessibilityLabel={logged ? "Logged" : "I cooked this"}
        >
          {logging ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : logged ? (
            <View style={styles.cookedBtnRow}>
              <Check size={18} color="#ffffff" />
              <Text style={styles.cookedBtnText}>Logged</Text>
            </View>
          ) : (
            <Text style={styles.cookedBtnText}>I cooked this</Text>
          )}
        </Pressable>
        {logged ? (
          <Pressable onPress={() => router.push("/cooked")} accessibilityRole="button">
            <Text style={styles.cookedLink}>View cooked meals →</Text>
          </Pressable>
        ) : null}
        {logError ? <Text style={styles.cookedError}>{logError}</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf8f3" },
  content: { padding: 20, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  backLink: { flexDirection: "row", alignItems: "center", gap: 2, marginBottom: 12 },
  backLinkText: { fontSize: 14, color: "#0c8a3e", fontWeight: "500" },
  hero: { width: "100%", height: 220, borderRadius: 16, marginBottom: 16 },
  eyebrow: { fontSize: 11, fontWeight: "600", color: "#0c8a3e", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 },
  title: { fontSize: 24, fontWeight: "700", color: "#1d2530", lineHeight: 30 },
  cuisine: { fontSize: 13, color: "#525d6a", marginTop: 4 },
  madeItHint: { fontSize: 13, color: "#525d6a", lineHeight: 19, marginBottom: 14 },
  servingsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  servingsLabel: { fontSize: 15, color: "#1d2530", fontWeight: "600" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 14 },
  stepperBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ece7dd",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#faf8f3",
  },
  stepperBtnDisabled: { opacity: 0.35 },
  stepperBtnText: { fontSize: 22, fontWeight: "600", color: "#1d2530", lineHeight: 26 },
  stepperValue: { fontSize: 17, fontWeight: "700", color: "#1d2530", minWidth: 24, textAlign: "center" },
  cookedBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#0c8a3e",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  cookedBtnDone: { backgroundColor: "#0a6e33" },
  cookedBtnRow: { flexDirection: "row", alignItems: "center", gap: 8 },
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
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: "#0c8a3e",
    borderRadius: 10,
  },
  backText: { color: "#ffffff", fontWeight: "600" },
});
