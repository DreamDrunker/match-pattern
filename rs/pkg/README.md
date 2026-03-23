# match-pattern-rs

English | [简体中文](README.zh-CN.md)

The Rust/WASM package in this repository. The current primary path compiles structural rules into `CompilePlan` instead of executing matchers directly.

The split with the TypeScript package is:

```text
TypeScript authors the DSL and executes matchers.
Rust/WASM provides an optional compile-plan backend.
```

## Exported APIs

| Export | Current role |
|---|---|
| `compile_match_plan(program)` | primary path; compiles `CompileProgram` into `CompilePlan` |
| `match_pattern(data, patterns)` | legacy runtime wasm matcher; not on the default TS engine hot path |

For the current TS integration, `compile_match_plan(...)` is the important export.

## Compile Input and Output

The primary path is:

```text
CompileProgram -> compile_match_plan(...) -> CompilePlan
```

`CompileProgram` contains only structural branches:

1. `actionIndex`
2. `predicate`

`CompilePlan` currently contains:

1. `version`
2. `branches`
3. `diagnostics`
4. `dynamicSlotCount`

Rust/WASM does not receive `.to(...)` / `.map(...)` closures.

## Compiler Responsibilities

1. Canonicalize analyzable predicates.
2. Lower `PredicateAst` into `CompiledPredicate`.
3. Produce `CompilePlan`.
4. Emit `unreachable_branch` and `dynamic_slot`.

## Non-goals

1. TypeScript type narrowing.
2. Zero-arg `run()` exhaustiveness rules.
3. Executing `CompilePlan`.
4. Calling JS predicates behind `slot`.

## Code Map

| Path | Role |
|---|---|
| `rs/src/lib.rs` | wasm exports |
| `rs/src/compiler.rs` | `CompileProgram -> CompilePlan` |
| `rs/src/matcher.rs` | legacy wasm runtime matcher |
| `rs/src/parser.rs` | pattern parser for the legacy path |
| `rs/src/types.rs` | legacy-path pattern types |

## Documentation

1. Integration overview: [ARCHITECTURE.md](ARCHITECTURE.md)
2. TS default engine: [../ts/ARCHITECTURE.md](../ts/ARCHITECTURE.md)
3. Public usage overview: [../README.md](../README.md)

## Commands

```bash
yarn test:rs
yarn test:rs:wasm
yarn rebuild:rs-pkg
yarn verify:rs-pkg
```
