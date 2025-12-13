import {
  Matcher,
  MatcherWithPattern,
  Pattern,
  PatternInput,
  ResultEntry,
} from "./types";

type WasmModule = {
  match_pattern: <T, R>(data: T, branches: PatternInput<T>[]) => R | undefined;
  log: (message: string) => void;
  test_reflect: () => void;
};

let wasmModule: WasmModule | null = null;

export const initMatchPattern = async (
  wasmBuffer?: Uint8Array,
): Promise<void> => {
  if (wasmModule) return;
  try {
    const wasm = await import("@weiqu_/match-pattern-rs");
    if (typeof wasm.default === "function") {
      if (wasmBuffer) await wasm.default({ module_or_path: wasmBuffer });
      else await wasm.default();
    }
    wasmModule = wasm as WasmModule;
  } catch (e) {
    throw new Error(`Failed to initialize match-pattern: ${e}`);
  }
};

export const match = <T>(data: T): Matcher<T, never> => {
  const branches: PatternInput<T>[] = [];
  const result: ResultEntry<T, unknown>[] = [];

  const createMatcher = <R>(): Matcher<T, R> => {
    const matcher: Matcher<T, R> = {
      when: (pattern: Pattern<T>) => ({
        to: <TResult>(value: TResult) => {
          branches.push(convertPattern(pattern));
          result.push({ value: value, isMapper: false });
          return createMatcher<R | TResult>();
        },
        map: <TResult>(fn: (data: T) => TResult) => {
          branches.push(convertPattern(pattern));
          result.push({ value: fn, isMapper: true });
          return createMatcher<R | TResult>();
        },
      }),
      otherwise: <TResult>(value: TResult) => {
        branches.push(convertPattern(undefined as Pattern<T>));
        result.push({ value: value, isMapper: false });
        return matcher.run() as R | TResult;
      },
      run: (): R => {
        if (!wasmModule)
          throw new Error(
            "match-pattern not initialized. Call initMatchPattern() first.",
          );
        const wasmIndex: number | undefined = wasmModule.match_pattern(
          data,
          branches,
        );
        if (result.length === 0) throw new Error("run what?");
        if (wasmIndex === undefined) throw new Error("No match found");
        const entry = result[wasmIndex];
        if (entry.isMapper) return entry.value(data) as R;
        return entry.value as R;
      },
    };
    return matcher;
  };

  return createMatcher<never>();
};

const convertPattern = <T>(pattern: Pattern<T>): PatternInput<T> => {
  if (pattern === undefined) return { type: "Wildcard" };
  if (typeof pattern === "function")
    return { type: "Function", func: pattern as (data: T) => boolean };
  if (typeof pattern === "object" && pattern !== null)
    return { type: "Object", pattern };
  return { type: "Value", value: pattern as T };
};
