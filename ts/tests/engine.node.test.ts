import { describe, expect, it, vi } from "vitest";

import { compileProgramInJs, createMatchEngine } from "../src/advanced";
import {
  and,
  eq,
  gt,
  isNumber,
  isString,
  match,
  shape,
  tag,
  wildcard,
} from "../src/index";

const NON_EXHAUSTIVE_HINT =
  "Non-exhaustive match. Add branches or use otherwise()." as const;

describe("engine compile pipeline", () => {
  it("compiles once for stable pattern structure", () => {
    const compiler = vi.fn(compileProgramInJs);
    const engine = createMatchEngine({
      compile: compiler,
      compilerVersion: "test-compiler-v1",
    });

    const run = (value: number | string) =>
      engine
        .match(value)
        .when(isNumber())
        .to(1)
        .when(isString())
        .to("1")
        .run();

    expect(run(1)).toBe(1);
    expect(run("a")).toBe("1");
    expect(run(2)).toBe(1);
    expect(compiler).toHaveBeenCalledTimes(1);
  });

  it("marks dynamic slot predicates and still caches", () => {
    const compiler = vi.fn(compileProgramInJs);
    const engine = createMatchEngine({
      compile: compiler,
      compilerVersion: "test-compiler-v2",
    });
    const runtimeRule = (value: number) => value > 5;

    const run = (value: number) =>
      engine.match(value).when(runtimeRule).to("ok").when(wildcard()).to("no").run();

    expect(run(8)).toBe("ok");
    expect(run(1)).toBe("no");
    expect(run(10)).toBe("ok");
    expect(compiler).toHaveBeenCalledTimes(1);
  });

  it("detects tag shadow diagnostics", () => {
    const event: { type: string; amount: number } = { type: "pay", amount: 10 };
    const diagnostics = match(event)
      .when(tag("type", "pay"))
      .to("pay")
      .when(and(tag("type", "pay"), shape({ amount: eq(10) })))
      .to("specific")
      .diagnostics();

    expect(
      diagnostics.some(
        (item) =>
          item.code === "unreachable_branch" && item.branchIndex === 1,
      ),
    ).toBe(true);
  });

  it("uses precompiled plans in fallback mode", () => {
    const seedEngine = createMatchEngine({
      compile: compileProgramInJs,
      compilerVersion: "seed",
    });
    const program = {
      branches: [
        { actionIndex: 0, predicate: { kind: "isNumber" as const } },
        { actionIndex: 1, predicate: { kind: "wildcard" as const } },
      ],
    };
    const key = seedEngine.buildCacheKey(program);
    const fallbackCompiler = vi.fn(compileProgramInJs);
    const engine = createMatchEngine({
      compile: fallbackCompiler,
      compilerVersion: "seed",
      precompiledPlans: {
        [key]: compileProgramInJs(program),
      },
    });

    const value: number | string = 7;
    const result = engine
      .match<number | string>(value)
      .when(isNumber())
      .to(1)
      .when(wildcard())
      .to(2)
      .run();
    expect(result).toBe(1);
    expect(fallbackCompiler).toHaveBeenCalledTimes(0);
  });

  it("supports guard predicate gt as runtime filter", () => {
    const result = match(101)
      .when(gt(100))
      .to("big")
      .when(wildcard())
      .to("small")
      .run();
    expect(result).toBe("big");
  });

  it("falls back to js compiler when primary compiler fails", () => {
    const primary = vi.fn(() => {
      throw new Error("wasm compiler unavailable");
    });
    const fallback = vi.fn(compileProgramInJs);
    const engine = createMatchEngine({
      compile: primary,
      fallbackCompile: fallback,
      compilerVersion: "fallback-v1",
    });

    const value: number | string = 3;
    const result = engine
      .match<number | string>(value)
      .when(isNumber())
      .to("number")
      .when(wildcard())
      .to("other")
      .run();

    expect(result).toBe("number");
    expect(primary).toHaveBeenCalledTimes(1);
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it("evicts old plans when cache capacity is exceeded", () => {
    const compiler = vi.fn(compileProgramInJs);
    const engine = createMatchEngine({
      compile: compiler,
      compilerVersion: "lru-v1",
      cacheSize: 1,
    });

    const runNumber = () => {
      const value: number | null = 1;
      return engine
        .match<number | null>(value)
        .when(isNumber())
        .to("n")
        .when(wildcard())
        .to("x")
        .run();
    };
    const runString = () => {
      const value: string | null = "v";
      return engine
        .match<string | null>(value)
        .when(isString())
        .to("s")
        .when(wildcard())
        .to("x")
        .run();
    };

    expect(runNumber()).toBe("n");
    expect(runString()).toBe("s");
    expect(runNumber()).toBe("n");
    expect(compiler).toHaveBeenCalledTimes(3);
  });

  it("uses stable cache keys for equivalent shape predicates", () => {
    const compiler = vi.fn(compileProgramInJs);
    const engine = createMatchEngine({
      compile: compiler,
      compilerVersion: "stable-key-v1",
    });

    const runFirst = () =>
      engine
        .match({ a: 1, b: 2 } as { a: number; b: number })
        .when(shape({ a: eq(1), b: eq(2) }))
        .to("ok")
        .when(wildcard())
        .to("no")
        .run();

    const runSecond = () =>
      engine
        .match({ a: 1, b: 2 } as { a: number; b: number })
        .when(shape({ b: eq(2), a: eq(1) }))
        .to("ok")
        .when(wildcard())
        .to("no")
        .run();

    expect(runFirst()).toBe("ok");
    expect(runSecond()).toBe("ok");
    expect(compiler).toHaveBeenCalledTimes(1);
  });

  it("reuses compiled matcher between diagnostics and run", () => {
    const compiler = vi.fn(compileProgramInJs);
    const engine = createMatchEngine({
      compile: compiler,
      compilerVersion: "diagnostics-v1",
    });

    const matcher = engine
      .match(1)
      .when((value) => value > 0)
      .to("first")
      .when(wildcard())
      .to("second");

    const diagnostics = matcher.diagnostics();
    expect(
      diagnostics.some(
        (item) =>
          item.code === "dynamic_slot" && item.branchIndex === 0,
      ),
    ).toBe(true);
    expect(matcher.run()).toBe("first");
    expect(compiler).toHaveBeenCalledTimes(1);
  });

  it("supports host-level precompiled plans without invoking compiler", () => {
    const seedEngine = createMatchEngine({
      compile: compileProgramInJs,
      compilerVersion: "host-precompiled-v1",
    });
    const program = {
      branches: [
        { actionIndex: 0, predicate: { kind: "isNumber" as const } },
        { actionIndex: 1, predicate: { kind: "wildcard" as const } },
      ],
    };
    const key = seedEngine.buildCacheKey(program);
    const hostPlan = compileProgramInJs(program);
    type HostGlobal = typeof globalThis & {
      __MATCH_PATTERN_PRECOMPILED__?: Record<string, typeof hostPlan>;
    };
    const host = globalThis as HostGlobal;
    const previous = host.__MATCH_PATTERN_PRECOMPILED__;

    try {
      host.__MATCH_PATTERN_PRECOMPILED__ = { [key]: hostPlan };
      const compiler = vi.fn(compileProgramInJs);
      const engine = createMatchEngine({
        compile: compiler,
        compilerVersion: "host-precompiled-v1",
      });

      const result = engine
        .match(9 as number | string)
        .when(isNumber())
        .to("n")
        .when(wildcard())
        .to("x")
        .run();

      expect(result).toBe("n");
      expect(compiler).toHaveBeenCalledTimes(0);
    } finally {
      if (previous === undefined) {
        delete host.__MATCH_PATTERN_PRECOMPILED__;
      } else {
        host.__MATCH_PATTERN_PRECOMPILED__ = previous;
      }
    }
  });

  it("supports registering precompiled plans after engine creation", () => {
    const compiler = vi.fn(compileProgramInJs);
    const engine = createMatchEngine({
      compile: compiler,
      compilerVersion: "register-precompiled-v1",
    });
    const program = {
      branches: [
        { actionIndex: 0, predicate: { kind: "isString" as const } },
        { actionIndex: 1, predicate: { kind: "wildcard" as const } },
      ],
    };
    const key = engine.buildCacheKey(program);
    engine.registerPrecompiledPlan(key, compileProgramInJs(program));

    const result = engine
      .match("hello" as string | number)
      .when(isString())
      .to("s")
      .when(wildcard())
      .to("x")
      .run();

    expect(result).toBe("s");
    expect(compiler).toHaveBeenCalledTimes(0);
  });

  it("throws explicit errors for invalid matcher execution", () => {
    const engine = createMatchEngine({
      compile: compileProgramInJs,
      compilerVersion: "errors-v1",
    });
    const value: number = 1;

    expect(() => engine.match(1).run(NON_EXHAUSTIVE_HINT)).toThrowError(
      "run what?",
    );
    expect(() =>
      engine.match(value).when(2).to("x").run(NON_EXHAUSTIVE_HINT),
    ).toThrowError(
      "No match found",
    );
  });
});
