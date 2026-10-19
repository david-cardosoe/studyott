// The one place database error keys become UI text. Postgres functions and
// triggers raise a stable key as the message (e.g. "subject_exists") plus a
// readable hint; the strings here mirror those hints.

const MESSAGES = {
  not_authenticated: "Please sign in again.",
  rate_limited:
    "Too many changes in a short time. Wait a minute and try again.",
  username_invalid:
    "Usernames are 3 to 20 characters: letters, numbers and _, starting with a letter.",
  username_reserved: "That username isn't available.",
  username_taken: "That username is taken.",
  subject_exists: "That subject is already in your list.",
  subject_name_invalid: "Subject names need 1 to 40 characters.",
  subject_limit_reached:
    "You have 100 subjects. Remove one you no longer use to add another.",
  subject_total_limit_reached:
    "You have reached the maximum number of subjects.",
  subject_inactive: "Pick a subject from your list.",
  session_date_in_future: "Sessions cannot be dated in the future.",
  daily_limit_exceeded: "That would put more than 24 hours on one day.",
  daily_session_limit: "You can log up to 50 sessions per day.",
  session_too_short: "Sessions need at least 1 minute.",
  duration_invalid: "Sessions can be at most 24 hours.",
  timezone_invalid: "Choose a timezone from the list.",
  timer_already_running: "A timer is already running.",
  timer_not_found: "This timer was already saved or discarded.",
  timer_conflict: "This timer changed on another device.",
  timer_not_running: "The timer is already paused.",
  timer_not_paused: "The timer is already running.",
  timer_max_reached:
    "Sessions can be at most 24 hours. Save or discard this one.",
} as const;

export type ErrorKey = keyof typeof MESSAGES;

export const GENERIC_ERROR = "Something went wrong. Please try again.";

// Shape shared by PostgrestError and AuthError.
type DbError =
  { message?: string; hint?: string | null; code?: string } | null | undefined;

export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string };

function isErrorKey(value: string): value is ErrorKey {
  return Object.hasOwn(MESSAGES, value);
}

/** The stable error key in a database error, if it has one. */
export function errorKey(error: DbError): ErrorKey | null {
  if (!error) return null;
  const message = error.message?.trim() ?? "";
  if (isErrorKey(message)) return message;
  // Unique violation on profiles.username (a race the trigger check can miss).
  if (error.code === "23505" && message.includes("username"))
    return "username_taken";
  return null;
}

/** Friendly text for any database or auth error. */
export function errorMessage(error: DbError): string {
  const key = errorKey(error);
  if (key) return MESSAGES[key];
  return error?.hint?.trim() || GENERIC_ERROR;
}
