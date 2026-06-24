import { API_BASE } from "./config";

export async function apiFetch(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.headers as Record<string, string> | undefined),
    },
  });
}
