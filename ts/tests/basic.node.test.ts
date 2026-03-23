import { describe, expect, it } from "vitest";

import { isNumber, match, shape } from "../src";

describe("basic", () => {
  it("number | string", () => {
    const nos = Math.random() > 0.5 ? 1 : "1";
    expect(match(nos).when("1").to("1").when(1).to("1").run()).toBe("1");
  });

  it("number | string | boolean", () => {
    const nosob =
      Math.random() > 0.5
        ? 1
        : Math.random() > 0.5
          ? "1"
          : Math.random() > 0.5
            ? true
            : false;
    expect(
      match(nosob)
        .when("1")
        .to("1")
        .when(1)
        .to("1")
        .when(false)
        .to("1")
        .when(true)
        .to("1")
        .run(),
    ).toBe("1");
  });

  it("object", () => {
    const obj = Math.random() > 0.5 ? ({ a: 1 } as const) : ({ b: 2 } as const);
    expect(
      match(obj)
        .when(shape({ a: 1 }))
        .to("1")
        .when(shape({ b: 2 }))
        .to("2")
        .run(),
    ).toBe(obj.a === 1 ? "1" : "2");
  });

  it("object with optional property", () => {
    const obj = { a: Math.random() > 0.5 ? 1 : 2 };

    expect(
      match(obj)
        .when(shape({ a: isNumber() }))
        .to(3)
        .run(),
    ).toBe(3);
  });
});
