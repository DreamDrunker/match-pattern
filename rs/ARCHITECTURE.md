# Architecture

English | [简体中文](ARCHITECTURE.zh-CN.md)

Scope: Rust/WASM compiler integration.

## Design Points

1. The current primary path in `rs` is a compiler, not an executor.
2. The default TS engine only calls `compile_match_plan(...)`.
3. `CompilePlan` execution still happens in JavaScript.

## Flow Overview

```text
TS matcher
  -> CompileProgram
  -> compile_match_plan(...)
  -> CompilePlan
  -> JS buildMatcher(...)
  -> matcher(value) -> actionIndex
```

## Code Entry Points

| Change area | Entry point |
|---|---|
| wasm exports and serialization boundary | `rs/src/lib.rs` |
| primary compiler logic | `rs/src/compiler.rs` |
| legacy runtime matcher | `rs/src/matcher.rs` |
| legacy pattern parsing | `rs/src/parser.rs` |
| legacy pattern types | `rs/src/types.rs` |

## Primary Path and Legacy Path

### Primary Path

The path used by the default TS engine is:

```text
CompileProgram -> compile_match_plan(...) -> CompilePlan
```

`compile_match_plan(...)` does only three things:

1. Deserialize `CompileProgram`.
2. Call `compile_program(...)`.
3. Serialize the result back into a JS-consumable `CompilePlan`.

### Legacy Path

`match_pattern(data, patterns)` is still exported, but it is not part of the current TS default-engine hot path.

It remains useful for:

1. wasm-side legacy tests
2. low-level debugging
3. a direct wasm path that tries patterns one by one

## `compiler.rs` Responsibilities

The current compile path has four steps:

1. `canonicalize_predicate(...)`
2. `lower_predicate(...)`
3. build `CompiledBranch`
4. produce `CompilePlan` and diagnostics

The current `CompilePlan` contains:

1. `version`
2. `branches`
3. `diagnostics`
4. `dynamic_slot_count`

## Parity Constraints with the TS Compiler

`rs/src/compiler.rs` and `ts/src/internal/compiler.ts` are paired implementations.

They need to stay aligned on at least:

| Item | Requirement |
|---|---|
| `CompilePlan` shape | identical |
| normalization rules | identical |
| `shape -> tagEq` conditions | identical |
| `and` / `or` flattening | identical |
| `wildcard -> true` lowering | identical |
| `unreachable_branch` conditions | identical |
| `dynamic_slot` conditions | identical |

Changes in Rust should be checked against the TS side by default.

## Design Constraints

| Boundary | Current rule |
|---|---|
| compiler input | structural `CompileProgram` only |
| actions | only `actionIndex`; no JS closures |
| dynamic predicates | preserved as `slot` |
| executor | outside Rust/WASM |
| type exhaustiveness | outside Rust/WASM |

## Not Implemented

1. No native wasm matcher hot path.
2. No generated-code executor.
3. No build-time integration.
4. No complete static proof for arbitrary JS predicates.
5. No benchmark-backed performance claims.

## Related Tests

1. `rs/tests/browser.rs`
2. `ts/tests/compiler-parity.node.test.ts`
3. `ts/tests/engine.node.test.ts`
