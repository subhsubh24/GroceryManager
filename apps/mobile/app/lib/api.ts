// In production, this would be SecureStore from expo-secure-store.
// For this skeleton: use module-level storage (resets on app restart — fine for prototype).
let _token: string | null = null;
let _baseUrl: string = "";

export function configureApi(baseUrl: string) {
  _baseUrl = baseUrl;
}

export function setToken(token: string) {
  _token = token;
}

export function clearToken() {
  _token = null;
}

export function isAuthenticated() {
  return _token !== null;
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  if (!_baseUrl) throw new Error("API_NOT_CONFIGURED");
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string>),
  };
  if (opts.method && opts.method !== "GET") {
    headers["Content-Type"] = "application/json";
  }
  if (_token) headers["Authorization"] = `Bearer ${_token}`;
  const res = await fetch(`${_baseUrl}${path}`, { ...opts, headers });
  if (res.status === 401) {
    clearToken();
    throw new Error("AUTH_401");
  }
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

export const api = {
  async signIn(username: string, password: string): Promise<string> {
    const data = await apiFetch("/api/v1/auth/token", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    const token: unknown = data?.token;
    if (typeof token !== "string" || !token) throw new Error("Invalid auth response");
    return token;
  },
  async getPantry() {
    return apiFetch("/api/v1/pantry", { method: "GET" });
  },
  async getList() {
    return apiFetch("/api/v1/list", { method: "GET" });
  },
};
