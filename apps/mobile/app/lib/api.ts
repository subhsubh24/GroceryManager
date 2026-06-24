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
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  if (_token) headers["Authorization"] = `Bearer ${_token}`;
  const res = await fetch(`${_baseUrl}${path}`, { ...opts, headers });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

export const api = {
  async signIn(username: string, password: string): Promise<string> {
    const data = await apiFetch("/api/v1/auth/token", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    return data.token as string;
  },
  async getPantry() {
    return apiFetch("/api/v1/pantry");
  },
  async getList() {
    return apiFetch("/api/v1/list");
  },
};
