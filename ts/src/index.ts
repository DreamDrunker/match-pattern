import {
  Matcher,
  MatcherWithPattern,
  Pattern,
  PatternInput,
  WasmBranch,
} from "./types";

type WasmModule = {
  match_pattern: <T, R>(data: T, branches: WasmBranch<T, R>[]) => R | undefined;
  log: (message: string) => void;
  test_reflect: () => void;
};

let wasmModule: WasmModule | null = null;

export const initMatchPattern = async (): Promise<void> => {
  if (wasmModule) return;
  try {
    const wasm = await import("@weiqu_/match-pattern-rs");
    if (typeof wasm.default === "function") {
      if (typeof process !== "undefined" && process.versions?.node) {
        const { readFile } = await import("fs/promises");
        const { dirname, join } = await import("path");
        const { createRequire } = await import("module");
        const require = createRequire(import.meta.url);
        const pkgPath = dirname(require.resolve("@weiqu_/match-pattern-rs"));
        const wasmPath = join(pkgPath, "match_pattern_rs_bg.wasm");
        const wasmBuffer = await readFile(wasmPath);
        await wasm.default({ module_or_path: wasmBuffer });
      } else {
        await wasm.default();
      }
    }
    wasmModule = wasm as WasmModule;
  } catch (e) {
    throw new Error(`Failed to initialize match-pattern: ${e}`);
  }
};

export const match = <T>(data: T): Matcher<T> => {
  const branches: WasmBranch<T, unknown>[] = [];
  const matcher: Matcher<T, any> = {
    when: (pattern: Pattern<T>): MatcherWithPattern<T, any> => ({
      to: (value) => {
        branches.push({
          pattern: convertPattern(pattern),
          result: value,
        });
        return matcher;
      },
    }),
    otherwise: (value) => {
      branches.push({
        pattern: { type: "Wildcard" },
        result: value,
      });
      return matcher.run();
    },
    run: () => {
      if (!wasmModule) {
        throw new Error(
          "match-pattern not initialized. Call initMatchPattern() first.",
        );
      }
      return wasmModule.match_pattern(data, branches);
    },
  };
  return matcher as Matcher<T>;
};

const convertPattern = <T>(pattern: Pattern<T>): PatternInput<T> => {
  if (pattern === undefined) return { type: "Wildcard" };
  if (typeof pattern === "function")
    return { type: "Function", func: pattern as (data: T) => boolean };
  if (typeof pattern === "object" && pattern !== null)
    return { type: "Object", pattern };
  return { type: "Value", value: pattern as T };
};
