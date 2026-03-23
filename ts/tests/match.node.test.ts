import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { createRequire } from "module";
import { beforeAll, describe, expect, it } from "vitest";

import {
  and,
  eq,
  exactShape,
  gt,
  initMatchPattern,
  match,
  not,
  or,
  shape,
  tag,
} from "../src/index";

const NON_EXHAUSTIVE_HINT =
  "Non-exhaustive match. Add branches or use otherwise()." as const;

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
    const value: number = 5;
    const result = match(value)
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
    const value: number[] = [1];
    const result = match(value)
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
    const value: number[] = [1, 2, 3];
    const result = match(value)
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
    const value: number = 5;
    const result = match(value).when(10).to("10").otherwise(undefined);
    expect(result).toBeUndefined();
  });

  it("should throw when boolean branches are not exhaustive and no otherwise", () => {
    const truthy: boolean = true;
    expect(() =>
      match<boolean>(truthy).when(false).to("false").run(NON_EXHAUSTIVE_HINT),
    ).toThrowError(
      "No match found",
    );
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
    const value: number = 10;
    const result = match(value)
      .when(5)
      .to("five")
      .when((x: number) => x > 5)
      .map((x) => `greater: ${x}`)
      .otherwise("default");
    expect(result).toBe("greater: 10");
  });

  it("should route discriminated-union events with tag + shape", () => {
    type Event =
      | { type: "pay"; amount: number; currency: "CNY" | "USD" }
      | { type: "refund"; refundId: string; amount: number }
      | { type: "ping" };

    const route = (event: Event): string =>
      match(event)
        .when(and(tag("type", "pay"), shape({ amount: gt(0) })))
        .to("process-pay")
        .when(tag("type", "refund"))
        .to("process-refund")
        .otherwise("ignore");

    expect(route({ type: "pay", amount: 88, currency: "CNY" })).toBe(
      "process-pay",
    );
    expect(route({ type: "refund", amount: 10, refundId: "r-1" })).toBe(
      "process-refund",
    );
    expect(route({ type: "ping" })).toBe("ignore");
  });

  it("should keep shape as partial and exactShape as strict", () => {
    const payload = {
      type: "pay",
      amount: 120,
      user: { id: "u-1" },
    };

    const partialResult = match(payload)
      .when(shape({ amount: gt(100) }))
      .to("hit")
      .otherwise("miss");
    const exactResult = match(payload)
      .when(
        exactShape({
          type: eq("pay"),
          amount: gt(100),
        }),
      )
      .to("hit")
      .otherwise("miss");

    expect(partialResult).toBe("hit");
    expect(exactResult).toBe("miss");
  });

  it("should support nested object + array partial matching in business payload", () => {
    const order = {
      orderId: "o-1",
      lines: [
        { sku: "A", qty: 2 },
        { sku: "B", qty: 1 },
      ],
      channel: "app",
    };

    const result = match(order)
      .when({ lines: [{ sku: "A", qty: 2 }] })
      .to("contains-a")
      .otherwise("none");

    expect(result).toBe("contains-a");
  });

  it("should combine and/or/not predicates for access-control rules", () => {
    type AccessRequest = {
      role: "admin" | "support" | "ops" | "guest";
      suspended: boolean;
      mfa: boolean;
    };

    const evaluate = (request: AccessRequest): string =>
      match(request)
        .when(
          and(
            shape({ role: eq("admin"), mfa: eq(true) }),
            not(shape({ suspended: eq(true) })),
          ),
        )
        .to("allow-admin")
        .when(or(shape({ role: eq("support") }), shape({ role: eq("ops") })))
        .to("allow-limited")
        .otherwise("deny");

    expect(
      evaluate({ role: "admin", suspended: false, mfa: true }),
    ).toBe("allow-admin");
    expect(
      evaluate({ role: "support", suspended: false, mfa: false }),
    ).toBe("allow-limited");
    expect(
      evaluate({ role: "admin", suspended: true, mfa: true }),
    ).toBe("deny");
    expect(evaluate({ role: "guest", suspended: false, mfa: true })).toBe("deny");
  });

  it("should compute derived values from complex payloads via map", () => {
    type CartItem = { price: number; count: number };
    type Cart = {
      items: CartItem[];
      coupon?: string;
    };
    const hasItems = (
      value: string | number | boolean | object | null | undefined,
    ): boolean => Array.isArray(value) && value.length > 0;
    const cart: Cart = {
      items: [
        { price: 10, count: 2 },
        { price: 20, count: 1 },
      ],
      coupon: "vip10",
    };

    const total = match(cart)
      .when(shape({ items: hasItems }))
      .map((value) =>
        value.items.reduce((sum, item) => sum + item.price * item.count, 0),
      )
      .otherwise(0);

    expect(total).toBe(40);
  });
});
