/**
 * Google OAuth token refresh (PLAN §5.1). The worker exchanges a stored refresh token for a
 * fresh access token to call Gmail offline. Network; client id/secret required.
 */
export interface RefreshedToken {
  accessToken: string;
  expiresAt: Date;
}

export async function refreshGoogleAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<RefreshedToken> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    // Bound the call below the serverless budget so a hung token endpoint fails fast (caught by the
    // sync's try/catch) rather than letting the platform kill the function with an uncatchable 504.
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) throw new Error(`Google token refresh ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: json.access_token, expiresAt: new Date(Date.now() + json.expires_in * 1000) };
}
