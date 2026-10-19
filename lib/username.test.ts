import { describe, expect, it } from "vitest";
import { usernameSchema } from "./username";

describe("usernameSchema", () => {
  it("trims and lowercases", () => {
    expect(usernameSchema.parse("  David_4821 ")).toBe("david_4821");
  });

  it.each(["ab", "1abc", "_abc", "has space", "a".repeat(21), "dash-name", ""])(
    "rejects %j",
    (name) => {
      expect(usernameSchema.safeParse(name).success).toBe(false);
    },
  );

  it.each(["abc", "a".repeat(20), "user_1", "Z9_"])("accepts %j", (name) => {
    expect(usernameSchema.safeParse(name).success).toBe(true);
  });
});
