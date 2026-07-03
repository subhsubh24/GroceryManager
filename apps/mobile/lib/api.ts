import { API_BASE } from "./config";

/** Default network timeout for mobile requests. Mobile links are flaky; without a ceiling a hung
 *  upstream leaves the app spinning forever. 15s is generous enough for a slow LTE round-trip while
 *  still failing fast enough that the caller's catch can surface a "connection timeout". */
export const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * fetch() with a hard timeout. Uses AbortController + setTimeout (universally supported on Hermes,
 * unlike the AbortSignal.timeout static). A caller that supplies its own `signal` opts out of the
 * default timeout. On timeout the returned promise rejects with an AbortError — callers already
 * handle fetch rejection (network failure), so the timeout degrades along the same path.
 */
export async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  if (options?.signal) return fetch(url, options);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function apiFetch(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<Response> {
  return fetchWithTimeout(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.headers as Record<string, string> | undefined),
    },
  });
}
