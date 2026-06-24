import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Redirect, router } from "expo-router";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";

const STEPS = ["Profile", "Diets", "Cuisines", "Done"] as const;
type Step = 0 | 1 | 2 | 3;

const DIETS = ["vegetarian", "vegan", "pescatarian", "gluten-free", "dairy-free", "keto", "halal", "kosher"];
const ALLERGENS = ["peanut", "tree nut", "shellfish", "dairy", "egg", "soy", "gluten", "sesame"];
const CUISINES = ["Italian", "Mexican", "Thai", "Indian", "Chinese", "Japanese", "Mediterranean", "American"];

function humanizeChip(s: string): string {
  return s
    .split(/[-\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function OnboardingScreen() {
  const { token } = useAuth();
  const [step, setStep] = useState<Step>(0);

  // Step 0 — profile
  const [name, setName] = useState("");

  // Step 1 — diets + allergens
  const [diets, setDiets] = useState<string[]>([]);
  const [allergens, setAllergens] = useState<string[]>([]);

  // Step 2 — cuisines + taste text
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [lovedText, setLovedText] = useState("");
  const [dislikedText, setDislikedText] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) return <Redirect href="/login" />;

  function toggleIn<T>(arr: T[], setArr: (a: T[]) => void, val: T) {
    setArr(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  }

  async function goNext() {
    if (saving || !token) return;
    setError(null);

    if (step === 0) {
      // Best-effort: save profile, never block flow on failure
      if (name.trim()) {
        try {
          setSaving(true);
          await apiFetch("/api/mobile/onboarding", token, {
            method: "POST",
            body: JSON.stringify({ action: "profile", name: name.trim() }),
          });
        } catch {
          // best-effort
        } finally {
          setSaving(false);
        }
      }
      setStep(1);
      return;
    }

    if (step === 1) {
      // Diets and allergens are sent together with cuisines in the step-2 "taste" POST,
      // so no API call needed here — the state values persist in React state.
      setStep(2);
      return;
    }

    if (step === 2) {
      // Best-effort: save taste signals
      try {
        setSaving(true);
        await apiFetch("/api/mobile/onboarding", token, {
          method: "POST",
          body: JSON.stringify({
            action: "taste",
            diets,
            allergens,
            lovedCuisines: cuisines,
            lovedIngredients: lovedText,
            dislikedIngredients: dislikedText,
          }),
        });
      } catch {
        // best-effort
      } finally {
        setSaving(false);
      }
      setStep(3);
      return;
    }

    if (step === 3) {
      // Finish: project model + mark onboarded
      try {
        setSaving(true);
        await apiFetch("/api/mobile/onboarding", token, {
          method: "POST",
          body: JSON.stringify({ action: "finish" }),
        });
        router.replace("/");
      } catch {
        setError("Couldn't finish setup — please try again.");
      } finally {
        setSaving(false);
      }
    }
  }

  function goBack() {
    if (step > 0) setStep((step - 1) as Step);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Progress bar */}
      <View style={styles.progressRow}>
        {STEPS.map((label, i) => (
          <View key={label} style={[styles.progressSegment, i <= step && styles.progressSegmentActive]} />
        ))}
      </View>
      <Text style={styles.stepLabel}>
        {STEPS[step]} · Step {step + 1} of {STEPS.length}
      </Text>

      {/* Step 0 — Profile */}
      {step === 0 && (
        <View style={styles.stepContent}>
          <Text style={styles.title}>A little about you</Text>
          <Text style={styles.blurb}>
            So recipes and plans feel made for you. You can update this anytime from Profile.
          </Text>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="What should we call you?"
            placeholderTextColor="#a3acb5"
            autoComplete="name"
            returnKeyType="done"
            onSubmitEditing={goNext}
          />
        </View>
      )}

      {/* Step 1 — Diets & Allergens */}
      {step === 1 && (
        <View style={styles.stepContent}>
          <Text style={styles.title}>How you eat</Text>
          <Text style={styles.blurb}>
            Pick any diets and allergens to follow. We'll filter recipes accordingly.
          </Text>

          <Text style={styles.sectionLabel}>Diets</Text>
          <View style={styles.chipRow}>
            {DIETS.map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.chip, diets.includes(d) && styles.chipOn]}
                onPress={() => toggleIn(diets, setDiets, d)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, diets.includes(d) && styles.chipTextOn]}>
                  {humanizeChip(d)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Allergies</Text>
          <View style={styles.chipRow}>
            {ALLERGENS.map((a) => (
              <TouchableOpacity
                key={a}
                style={[styles.chip, allergens.includes(a) && styles.chipOn]}
                onPress={() => toggleIn(allergens, setAllergens, a)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, allergens.includes(a) && styles.chipTextOn]}>
                  {humanizeChip(a)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Step 2 — Cuisines & taste */}
      {step === 2 && (
        <View style={styles.stepContent}>
          <Text style={styles.title}>What you love</Text>
          <Text style={styles.blurb}>
            Cuisines and ingredients to lean toward — and a few to avoid. All optional.
          </Text>

          <Text style={styles.sectionLabel}>Cuisines you love</Text>
          <View style={styles.chipRow}>
            {CUISINES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, cuisines.includes(c) && styles.chipOn]}
                onPress={() => toggleIn(cuisines, setCuisines, c)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, cuisines.includes(c) && styles.chipTextOn]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Ingredients you love</Text>
          <TextInput
            style={styles.input}
            value={lovedText}
            onChangeText={setLovedText}
            placeholder="salmon, basil, feta"
            placeholderTextColor="#a3acb5"
            returnKeyType="next"
          />

          <Text style={styles.sectionLabel}>Ingredients you avoid</Text>
          <TextInput
            style={styles.input}
            value={dislikedText}
            onChangeText={setDislikedText}
            placeholder="cilantro, olives"
            placeholderTextColor="#a3acb5"
            returnKeyType="done"
            onSubmitEditing={goNext}
          />
        </View>
      )}

      {/* Step 3 — Done */}
      {step === 3 && (
        <View style={styles.stepContent}>
          <View style={styles.doneMark}>
            <Text style={styles.doneGlyph}>✓</Text>
          </View>
          <Text style={styles.title}>You&apos;re all set</Text>
          <Text style={styles.blurb}>
            Your kitchen is tuned to your taste. We&apos;ll keep learning from what you cook, save,
            and skip.
          </Text>
          <Text style={styles.doneNote}>
            Head to Pantry → Quick add to add your first items. We&apos;ll learn from what you
            cook, save, and skip — your taste gets sharper over time.
          </Text>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Footer buttons */}
      <View style={styles.footer}>
        {step > 0 && step < 3 ? (
          <TouchableOpacity style={styles.backBtn} onPress={goBack} disabled={saving}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}

        <View style={styles.footerRight}>
          {/* Skip available on steps 1 and 2 */}
          {(step === 1 || step === 2) && (
            <TouchableOpacity style={styles.skipBtn} onPress={goNext} disabled={saving}>
              <Text style={styles.skipBtnText}>Skip</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]}
            onPress={goNext}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {step === 3 ? "Go to my kitchen" : "Continue →"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf8f3" },
  content: { padding: 20, paddingBottom: 48, minHeight: "100%" },

  progressRow: { flexDirection: "row", gap: 6, marginBottom: 6 },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ece7dd",
  },
  progressSegmentActive: { backgroundColor: "#0c8a3e" },
  stepLabel: { fontSize: 11, fontWeight: "700", color: "#a3acb5", letterSpacing: 0.5, marginBottom: 28 },

  stepContent: { flex: 1 },
  title: { fontSize: 26, fontWeight: "700", color: "#1d2530", marginBottom: 8 },
  blurb: { fontSize: 15, color: "#525d6a", lineHeight: 22, marginBottom: 24 },

  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#525d6a", marginBottom: 6 },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#ece7dd",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: "#1d2530",
    marginBottom: 16,
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#525d6a",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ece7dd",
    backgroundColor: "#ffffff",
  },
  chipOn: { backgroundColor: "#0c8a3e", borderColor: "#0c8a3e" },
  chipText: { fontSize: 14, color: "#525d6a", fontWeight: "500" },
  chipTextOn: { color: "#ffffff", fontWeight: "600" },

  doneMark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#0c8a3e",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  doneGlyph: { color: "#ffffff", fontSize: 32 },
  doneNote: { fontSize: 13, color: "#a3acb5", marginTop: 16, lineHeight: 20 },

  errorBox: {
    backgroundColor: "#fdecea",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { color: "#8e261b", fontSize: 14 },

  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 32,
    gap: 8,
  },
  footerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  backBtn: { paddingVertical: 12, paddingHorizontal: 4 },
  backBtnText: { fontSize: 15, color: "#525d6a" },
  skipBtn: { paddingVertical: 12, paddingHorizontal: 12 },
  skipBtnText: { fontSize: 15, color: "#a3acb5" },
  primaryBtn: {
    backgroundColor: "#0c8a3e",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 140,
  },
  primaryBtnDisabled: { backgroundColor: "#a3acb5" },
  primaryBtnText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
});
