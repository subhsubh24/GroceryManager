/**
 * RevenueCat in-app-purchase wrapper (mobile entitlement). Mirrors the web Stripe pattern: the
 * purchase flow is REAL when configured and degrades to an honest "coming soon" state when the
 * public SDK key is absent (CI / dev / pre-launch), so the screen never dead-ends.
 *
 * Identity: we call `Purchases.logIn(userId)` with the app's DB user id so RevenueCat's
 * `app_user_id` maps 1:1 to our user. The RevenueCat → server webhook
 * (`/api/webhooks/revenuecat`) then writes the entitlement signal the rest of the app reads via
 * `isPremium()`, exactly like the Stripe webhook does for web. The "premium" entitlement id and the
 * monthly/annual product ids are configured by the owner in the RevenueCat dashboard (see
 * PENDING_OPS.md); this client only needs the PUBLIC SDK key.
 *
 * The native module (react-native-purchases) autolinks under Expo's prebuild / dev-client; it is a
 * no-op in Expo Go. Every entry point below is guarded so an unconfigured build is inert and safe.
 */
import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from "react-native-purchases";

/** RevenueCat entitlement identifier the dashboard grants on a paid product (owner-configured). */
export const PREMIUM_ENTITLEMENT = "premium";

/** Public SDK key, platform-specific. Safe to ship in the client (NOT the secret REST key). */
function publicApiKey(): string | null {
  const key =
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  return key && key.trim().length > 0 ? key.trim() : null;
}

/** True when a public SDK key is present → real purchases are wired. */
export function isPurchasesConfigured(): boolean {
  return publicApiKey() !== null;
}

let configuredFor: string | null = null;

/**
 * Configure RevenueCat once and identify the user. Idempotent per user; no-op when unconfigured.
 * Returns false when purchases are not available (no key) so callers can render the honest state.
 */
export async function initPurchases(userId: string): Promise<boolean> {
  const apiKey = publicApiKey();
  if (!apiKey) return false;
  try {
    if (configuredFor === null) {
      if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
      Purchases.configure({ apiKey, appUserID: userId });
      configuredFor = userId;
    } else if (configuredFor !== userId) {
      await Purchases.logIn(userId);
      configuredFor = userId;
    }
    return true;
  } catch {
    // Native module unavailable (e.g. Expo Go) or config error — degrade to the honest state.
    return false;
  }
}

/** Does this CustomerInfo carry an active premium entitlement? */
export function hasPremiumEntitlement(info: CustomerInfo | null | undefined): boolean {
  return Boolean(info?.entitlements?.active?.[PREMIUM_ENTITLEMENT]);
}

/** The current offering (its `availablePackages` drive the purchase buttons), or null. */
export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!isPurchasesConfigured()) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch {
    return null;
  }
}

/** Read the cached entitlement state without making a purchase. */
export async function isPremiumActive(): Promise<boolean> {
  if (!isPurchasesConfigured()) return false;
  try {
    return hasPremiumEntitlement(await Purchases.getCustomerInfo());
  } catch {
    return false;
  }
}

export type PurchaseOutcome =
  | { status: "active" }
  | { status: "inactive" }
  | { status: "cancelled" }
  | { status: "error"; message: string };

/**
 * Purchase a package. The App Store / Play sheet is presented by the SDK; on success we read the
 * resulting entitlement (the server is synced authoritatively by the RevenueCat webhook). A user
 * cancellation is NOT an error — it returns `cancelled` so the UI stays calm.
 */
export async function purchase(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  if (!isPurchasesConfigured()) return { status: "error", message: "Purchases are not available." };
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return hasPremiumEntitlement(customerInfo) ? { status: "active" } : { status: "inactive" };
  } catch (e: unknown) {
    const err = e as { userCancelled?: boolean; message?: string };
    if (err?.userCancelled) return { status: "cancelled" };
    return { status: "error", message: err?.message ?? "Purchase failed. Please try again." };
  }
}

/** Restore prior purchases (App Store requirement). Returns whether premium is now active. */
export async function restore(): Promise<PurchaseOutcome> {
  if (!isPurchasesConfigured()) return { status: "error", message: "Purchases are not available." };
  try {
    const info = await Purchases.restorePurchases();
    return hasPremiumEntitlement(info) ? { status: "active" } : { status: "inactive" };
  } catch (e: unknown) {
    const err = e as { message?: string };
    return { status: "error", message: err?.message ?? "Couldn't restore purchases." };
  }
}
