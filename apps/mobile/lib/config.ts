// Set EXPO_PUBLIC_API_URL in apps/mobile/.env to point at your web server.
// For local dev: http://<your-lan-ip>:3000  (localhost won't work on a physical device).
// For production: the deployed URL.
export const API_BASE: string = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
