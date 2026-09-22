export type MobileConfig = {
  apiUrl: string;
  origin: string;
  cookieName: string;
};

export function validateConfig(
  apiUrl: string | undefined,
  origin: string | undefined,
  cookieName: string | undefined,
  development: boolean,
): MobileConfig {
  if (!apiUrl || !origin || !cookieName)
    throw new Error(
      "Configure EXPO_PUBLIC_API_URL, EXPO_PUBLIC_APP_ORIGIN and EXPO_PUBLIC_SESSION_COOKIE_NAME in mobile/.env.",
    );
  const api = new URL(apiUrl);
  const app = new URL(origin);
  for (const url of [api, app]) {
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error("Invalid mobile API configuration.");
    if (!development && url.protocol !== "https:")
      throw new Error("Release builds require HTTPS.");
  }
  if (app.pathname !== "/" || !/^[A-Za-z0-9_-]+$/.test(cookieName))
    throw new Error("Invalid origin or cookie name.");
  if (!development && !cookieName.startsWith("__Host-"))
    throw new Error("Release sessions require a __Host- cookie.");
  return { apiUrl: apiUrl.replace(/\/$/, ""), origin: app.origin, cookieName };
}
