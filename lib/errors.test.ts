import { describe, expect, it } from "vitest";
import { errorKey, errorMessage, GENERIC_ERROR } from "./errors";

describe("errorKey", () => {
  it("reads the stable key from the message", () => {
    expect(errorKey({ message: "subject_exists", hint: "x" })).toBe(
      "subject_exists",
    );
  });

  it("maps a unique violation on username to username_taken", () => {
    expect(
      errorKey({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "profiles_username_key"',
      }),
    ).toBe("username_taken");
  });

  it("returns null for unknown or missing errors", () => {
    expect(errorKey({ message: "something else" })).toBeNull();
    expect(errorKey(null)).toBeNull();
    expect(errorKey({ message: "toString" })).toBeNull();
  });
});

describe("errorMessage", () => {
  it("uses the mapped text for known keys", () => {
    expect(errorMessage({ message: "username_taken" })).toBe(
      "That username is taken.",
    );
  });

  it("falls back to the database hint, then a generic message", () => {
    expect(errorMessage({ message: "new_key", hint: "Readable hint." })).toBe(
      "Readable hint.",
    );
    expect(errorMessage({ message: "boom" })).toBe(GENERIC_ERROR);
    expect(errorMessage(undefined)).toBe(GENERIC_ERROR);
  });
});
