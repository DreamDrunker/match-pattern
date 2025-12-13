import { describe, it, expect, beforeAll } from "vitest";
import { initMatchPattern, match } from "../src/index";

beforeAll(async () => {
  await initMatchPattern();
});

describe("match-pattern (browser)", () => {
  it("should match exact value", () => {
    const result = match(5)
      .when(5)
      .to("five")
      .when(10)
      .to("ten")
      .otherwise("unknown");
    expect(result).toBe("five");
  });

  it("should match array (partial match)", () => {
    const result = match([1, 2, 3])
      .when([1, 2])
      .to("partial match")
      .otherwise("no match");
    expect(result).toBe("partial match");
  });

  it("should match Object (partial match)", () => {
    const http_resp = { status: 200, success: true, data: { records: [1] } };
    const result = match(http_resp)
      .when({ status: 200, data: { records: [1] } })
      .to(true)
      .otherwise(false);
    expect(result).toBe(true);
  });

  it("should match function", () => {
    const result = match(5)
      .when((x) => x < 3)
      .to("less than 3")
      .when((x) => x > 2)
      .to("greater than 2")
      .otherwise("default");
    expect(result).toBe("greater than 2");
  });

  it("should transform value with map", () => {
    const result = match(5)
      .when((x) => x > 2)
      .map((x) => x * 2)
      .otherwise(0);
    expect(result).toBe(10);
  });

  it("should use map with object pattern", () => {
    const user = { name: "Alice", age: 25 };
    const result = match(user)
      .when({ age: 25 })
      .map((u) => `${u.name} is 25 years old`)
      .otherwise("unknown");
    expect(result).toBe("Alice is 25 years old");
  });

  it("should mix to and map", () => {
    const result = match(10)
      .when(5)
      .to("five")
      .when((x) => x > 5)
      .map((x) => `greater: ${x}`)
      .otherwise("default");
    expect(result).toBe("greater: 10");
  });
});
