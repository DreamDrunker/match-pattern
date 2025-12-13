import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { createRequire } from "module";
import { initMatchPattern, match } from "../src/index";

const loadWasmForNode = async (): Promise<Uint8Array> => {
  const require = createRequire(import.meta.url);
  const pkgPath = dirname(require.resolve("@weiqu_/match-pattern-rs"));
  const buffer = await readFile(join(pkgPath, "match_pattern_rs_bg.wasm"));
  return new Uint8Array(buffer);
};

beforeAll(async () => {
  const wasmBuffer = await loadWasmForNode();
  await initMatchPattern(wasmBuffer);
});

describe("match-pattern", () => {
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

  it("should match array", () => {
    const result = match([1])
      .when([1, 2, 3])
      .to("exact match")
      .otherwise("no match");
    expect(result).toBe("no match");
  });

  it("should match Object(partial match)", () => {
    const http_resp = { status: 200, success: true, data: { records: [1] } };
    const result = match(http_resp)
      .when({ status: 200, data: { records: [1] } })
      .to(true)
      .otherwise(false);
    expect(result).toBe(true);
  });

  it("should match array exact", () => {
    const result = match([1, 2, 3])
      .when([4, 5])
      .to("no")
      .when([1, 2, 3])
      .to("exact match")
      .otherwise("no match");
    expect(result).toBe("exact match");
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

  it("should return undefined when no match and no otherwise", () => {
    const result = match(5).when(10).to("10").otherwise(undefined);
    expect(result).toBeUndefined();
  });

  it("should return function itself with to", () => {
    const double = (x: number) => x * 2;
    const result = match(5)
      .when((x) => x > 2)
      .to(double)
      .otherwise(null);
    expect(result).toBe(double);
    expect(result!(10)).toBe(20);
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
