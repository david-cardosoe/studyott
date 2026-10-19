// The email/password test login exists only for local development and
// Playwright, against the local Supabase stack. Production auth is Google-only
// (and the Email provider is off in the production project as well).
export function isDevLoginEnabled() {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.LOCAL_AUTH_ENABLED === "true"
  );
}
