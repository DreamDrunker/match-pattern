import type { CompilePlan, CompileProgram } from "./internal/ast";
import { compileProgramInJs } from "./internal/compiler";
import { createMatchEngine } from "./internal/engine";
import {
  and,
  eq,
  exactShape,
  getDefaultSlotRegistry,
  gt,
  isBoolean,
  isNull,
  isNumber,
  isString,
  isUndefined,
  lt,
  not,
  or,
  shape,
  slot,
  tag,
  wildcard,
} from "./internal/predicate";
import type { Matcher } from "./types";

type WasmModule = {
  compile_match_plan?: (program: CompileProgram) => CompilePlan;
  log?: (message: string) => void;
  test_reflect?: () => void;
};

let wasmModule: WasmModule | null = null;

const compileViaWasmOrJs = (program: CompileProgram): CompilePlan => {
  if (wasmModule?.compile_match_plan) {
    return wasmModule.compile_match_plan(program);
  }
  return compileProgramInJs(program);
};

const engine = createMatchEngine({
  compile: compileViaWasmOrJs,
  fallbackCompile: compileProgramInJs,
  compilerVersion: () =>
    wasmModule?.compile_match_plan ? "rust-compiler-v1" : "js-compiler-v1",
  slotRegistry: getDefaultSlotRegistry(),
});

export const initMatchPattern = async (
  wasmBuffer?: Uint8Array,
): Promise<void> => {
  if (wasmModule) {
    return;
  }
  try {
    const wasm = await import("@weiqu_/match-pattern-rs");
    if (typeof wasm.default === "function") {
      if (wasmBuffer) {
        await wasm.default({ module_or_path: wasmBuffer });
      } else {
        await wasm.default();
      }
    }
    wasmModule = wasm as WasmModule;
  } catch (error) {
    throw new Error(`Failed to initialize match-pattern: ${String(error)}`);
  }
};

export const match = <const TData>(data: TData): Matcher<TData, never> =>
  engine.match(data);

export {
  and,
  compileProgramInJs,
  createMatchEngine,
  eq,
  exactShape,
  gt,
  isBoolean,
  isNull,
  isNumber,
  isString,
  isUndefined,
  lt,
  not,
  or,
  shape,
  slot,
  tag,
  wildcard,
};
