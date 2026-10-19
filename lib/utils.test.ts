import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("joins classes and lets later Tailwind classes win", () => {
    const hidden = false;
    expect(cn("px-2 text-sm", hidden && "hidden", "px-4")).toBe("text-sm px-4");
  });
});
