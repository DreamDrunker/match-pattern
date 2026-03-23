import { readFile } from "fs/promises";
import { beforeAll, describe, expect, it } from "vitest";

import { compileProgramInJs } from "../src/advanced";
import type { CompileProgram } from "../src/advanced";

type WasmCompilerModule = {
  compile_match_plan: (program: CompileProgram) => unknown;
  default?: (input?: { module_or_path?: Uint8Array }) => Promise<unknown>;
};

const loadWasmForNode = async (): Promise<Uint8Array> => {
  const buffer = await readFile(
    new URL("../../rs/pkg/match_pattern_rs_bg.wasm", import.meta.url),
  );
  return new Uint8Array(buffer);
};

let wasmCompiler: WasmCompilerModule | null = null;

beforeAll(async () => {
  const wasm = (await import("../../rs/pkg/match_pattern_rs.js")) as unknown as WasmCompilerModule;
  if (typeof wasm.default === "function") {
    await wasm.default({ module_or_path: await loadWasmForNode() });
  }
  wasmCompiler = wasm;
});

describe("compiler parity", () => {
  it("matches js and wasm compile plans for analyzable predicates", () => {
    const program: CompileProgram = {
      branches: [
        {
          actionIndex: 0,
          predicate: { kind: "isNumber" },
        },
        {
          actionIndex: 1,
          predicate: {
            kind: "and",
            predicates: [
              { kind: "tag", key: "type", value: "pay" },
              {
                kind: "shape",
                fields: {
                  amount: { kind: "eq", value: 10 },
                },
              },
            ],
          },
        },
        {
          actionIndex: 2,
          predicate: {
            kind: "shape",
            exact: true,
            fields: {
              status: { kind: "eq", value: "ok" },
            },
          },
        },
      ],
    };

    const jsPlan = compileProgramInJs(program);
    const wasmPlan = wasmCompiler?.compile_match_plan(program);

    expect(wasmPlan).toEqual(jsPlan);
  });

  it("matches js and wasm diagnostics for runtime slot programs", () => {
    const program: CompileProgram = {
      branches: [
        {
          actionIndex: 0,
          predicate: { kind: "slot", slot: 2 },
        },
        {
          actionIndex: 1,
          predicate: { kind: "wildcard" },
        },
      ],
    };

    const jsPlan = compileProgramInJs(program);
    const wasmPlan = wasmCompiler?.compile_match_plan(program);

    expect(wasmPlan).toEqual(jsPlan);
  });
});
