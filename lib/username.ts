import { z } from "zod";

// Mirrors the check in Postgres (profiles.username). The database is the
// real gate; this only gives instant feedback while typing.
export const USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,19}$/;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, "username_invalid");

/** What `username_available` returns. */
export type UsernameStatus = "available" | "taken" | "reserved" | "invalid";
