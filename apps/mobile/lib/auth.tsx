import React, { createContext, useContext, useState } from "react";
import { API_BASE } from "./config";

type AuthState = {
  token: string | null;
  userId: string | null;
  userName: string | null;
};

type AuthContextType = AuthState & {
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ token: null, userId: null, userName: null });

  async function login(
    username: string,
    password: string,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/api/mobile/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as { token?: string; userId?: string; name?: string | null; error?: string };
      if (!res.ok || !data.token || !data.userId) {
        return { ok: false, error: data.error ?? "Login failed" };
      }
      setState({ token: data.token, userId: data.userId, userName: data.name ?? null });
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error — check your connection" };
    }
  }

  function logout() {
    setState({ token: null, userId: null, userName: null });
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be called inside <AuthProvider>");
  return ctx;
}
