import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { API_BASE } from "./config";
import { fetchWithTimeout } from "./api";
import { deregisterPushNotifications, registerForPushNotifications } from "./notifications";

const STORAGE_KEY = "@gm/auth";

type AuthState = {
  token: string | null;
  userId: string | null;
  userName: string | null;
};

type AuthContextType = AuthState & {
  ready: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ token: null, userId: null, userName: null });
  const [ready, setReady] = useState(false);

  // Restore persisted session on app launch
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const saved = JSON.parse(raw) as AuthState;
          if (saved.token) setState(saved);
        }
      })
      .catch(() => {
        // Corrupt storage — ignore, user will need to sign in
      })
      .finally(() => setReady(true));
  }, []);

  async function login(
    username: string,
    password: string,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/mobile/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as {
        token?: string;
        userId?: string;
        name?: string | null;
        error?: string;
      };
      if (!res.ok || !data.token || !data.userId) {
        return { ok: false, error: data.error ?? "Login failed" };
      }
      const next: AuthState = {
        token: data.token,
        userId: data.userId,
        userName: data.name ?? null,
      };
      setState(next);
      // Persist across app restarts; fire-and-forget push registration
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      registerForPushNotifications(data.token).catch(() => {});
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error — check your connection" };
    }
  }

  function logout() {
    // Deregister push token before clearing session
    if (state.token) {
      deregisterPushNotifications(state.token).catch(() => {});
    }
    setState({ token: null, userId: null, userName: null });
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }

  return (
    <AuthContext.Provider value={{ ...state, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be called inside <AuthProvider>");
  return ctx;
}
