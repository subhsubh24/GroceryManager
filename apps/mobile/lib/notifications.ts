/**
 * Expo push notification registration.
 *
 * Usage: call registerForPushNotifications() after sign-in, passing the auth token so
 * the server can store the Expo push token for this device.
 *
 * Requires EXPO_PUBLIC_PROJECT_ID to be set (EAS project ID — see PENDING_OPS.md).
 * Without it the registration is a no-op: the function returns null silently and
 * the rest of the app is unaffected.
 */
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { API_BASE } from "./config";
import { fetchWithTimeout } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Request push permission and register the Expo push token with the backend.
 * Best-effort: any failure is caught and logged; never throws.
 */
export async function registerForPushNotifications(authToken: string): Promise<void> {
  const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;
  if (!projectId) return; // Human Core: set EAS project ID to activate

  if (!Device.isDevice) return; // push tokens don't work on simulators

  // Android 13+ requires explicit permission
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return; // user declined — silent no-op

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    await fetchWithTimeout(`${API_BASE}/api/mobile/push-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token }),
    });
  } catch {
    // Best-effort: never block the user if push registration fails
  }
}

/**
 * Deregister the push token for this device on sign-out.
 * Best-effort: failure is swallowed.
 */
export async function deregisterPushNotifications(authToken: string): Promise<void> {
  const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;
  if (!projectId || !Device.isDevice) return;

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    await fetchWithTimeout(`${API_BASE}/api/mobile/push-token`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token: token.data }),
    });
  } catch {
    // Best-effort
  }
}
