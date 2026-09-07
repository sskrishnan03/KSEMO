export const ENV = {
  appId: process.env.VITE_APP_ID ?? "ksemo-app",
  cookieSecret:
    process.env.JWT_SECRET ||
    "ksemo-session-secret-key-32-chars-minimum-fallback!!",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
