import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { Redirect, router } from "expo-router";
import { useAuth } from "../lib/auth";
import { SUBSCRIPTION_PLANS, PREMIUM_PERKS } from "@gm/core/billing";

const MONTHLY = SUBSCRIPTION_PLANS.find((p) => p.tier === "premium_monthly");
const ANNUAL = SUBSCRIPTION_PLANS.find((p) => p.tier === "premium_annual");

const MONTHLY_PRICE = MONTHLY?.priceMonthCents ? (MONTHLY.priceMonthCents / 100).toFixed(2) : "4.99";
const ANNUAL_PRICE = ANNUAL?.priceAnnualCents ? (ANNUAL.priceAnnualCents / 100).toFixed(2) : "39.99";
// Effective monthly cost of the annual plan
const ANNUAL_MONTHLY = ANNUAL?.priceAnnualCents
  ? (ANNUAL.priceAnnualCents / 100 / 12).toFixed(2)
  : "3.33";

export default function UpgradeScreen() {
  const { token } = useAuth();

  if (!token) return <Redirect href="/login" />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.starMark}>
          <Text style={styles.starGlyph}>★</Text>
        </View>
        <Text style={styles.title}>Go Premium</Text>
        <Text style={styles.subtitle}>
          Unlock the AI planner, unlimited Discover, recipe remix, and more.
        </Text>
      </View>

      {/* Pricing cards */}
      <View style={styles.plansRow}>
        <View style={styles.planCard}>
          <Text style={styles.planLabel}>Monthly</Text>
          <Text style={styles.planPrice}>${MONTHLY_PRICE}</Text>
          <Text style={styles.planPer}>per month</Text>
          <Text style={styles.planTrial}>{MONTHLY?.trialDays ?? 7}-day free trial</Text>
        </View>

        <View style={[styles.planCard, styles.planCardFeatured]}>
          <View style={styles.recommendedBadge}>
            <Text style={styles.recommendedText}>Best value</Text>
          </View>
          <Text style={[styles.planLabel, styles.planLabelFeatured]}>Annual</Text>
          <Text style={[styles.planPrice, styles.planPriceFeatured]}>${ANNUAL_MONTHLY}</Text>
          <Text style={[styles.planPer, styles.planPerFeatured]}>per month</Text>
          <Text style={[styles.planTrial, styles.planTrialFeatured]}>
            ${ANNUAL_PRICE}/yr · save ~33% vs monthly
          </Text>
        </View>
      </View>

      {/* Premium features */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What you unlock</Text>
        {PREMIUM_PERKS.map((perk) => (
          <View key={perk.feature} style={styles.perkRow}>
            <Text style={styles.perkCheck}>✓</Text>
            <View style={styles.perkText}>
              <Text style={styles.perkTitle}>{perk.title}</Text>
              <Text style={styles.perkBlurb}>{perk.blurb}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* CTA — payments connect via PENDING_OPS.md (RevenueCat / Stripe) */}
      <View style={styles.ctaSection}>
        <Pressable style={styles.ctaBtn} disabled>
          <Text style={styles.ctaBtnText}>Start free trial</Text>
        </Pressable>
        <Text style={styles.ctaHint}>
          Payments coming soon — connect RevenueCat to activate.
        </Text>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Maybe later</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf8f3" },
  content: { padding: 20, paddingBottom: 48 },

  header: { alignItems: "center", marginBottom: 24 },
  starMark: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#4a1d96",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  starGlyph: { color: "#ffffff", fontSize: 28 },
  title: { fontSize: 26, fontWeight: "700", color: "#1d2530", marginBottom: 8 },
  subtitle: { fontSize: 15, color: "#525d6a", textAlign: "center", lineHeight: 22 },

  plansRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  planCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#ece7dd",
    alignItems: "center",
  },
  planCardFeatured: {
    backgroundColor: "#4a1d96",
    borderColor: "#4a1d96",
  },
  recommendedBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  recommendedText: { color: "#ffffff", fontSize: 11, fontWeight: "700" },
  planLabel: { fontSize: 13, fontWeight: "700", color: "#a3acb5", marginBottom: 4 },
  planLabelFeatured: { color: "rgba(255,255,255,0.75)" },
  planPrice: { fontSize: 28, fontWeight: "800", color: "#1d2530" },
  planPriceFeatured: { color: "#ffffff" },
  planPer: { fontSize: 12, color: "#a3acb5", marginBottom: 4 },
  planPerFeatured: { color: "rgba(255,255,255,0.75)" },
  planTrial: { fontSize: 11, color: "#a3acb5", textAlign: "center" },
  planTrialFeatured: { color: "rgba(255,255,255,0.7)" },

  section: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ece7dd",
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#a3acb5",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  perkRow: { flexDirection: "row", marginBottom: 12 },
  perkCheck: { color: "#0c8a3e", fontWeight: "700", fontSize: 16, marginRight: 10, marginTop: 1 },
  perkText: { flex: 1 },
  perkTitle: { fontSize: 14, fontWeight: "700", color: "#1d2530" },
  perkBlurb: { fontSize: 13, color: "#525d6a", lineHeight: 18, marginTop: 2 },

  ctaSection: { alignItems: "center" },
  ctaBtn: {
    width: "100%",
    backgroundColor: "#a3acb5",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 8,
  },
  ctaBtnText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  ctaHint: { fontSize: 12, color: "#a3acb5", textAlign: "center", marginBottom: 16 },
  backLink: { paddingVertical: 8 },
  backLinkText: { fontSize: 14, color: "#a3acb5" },
});
