# Architecture

English | [简体中文](ARCHITECTURE.zh-CN.md)

Scope: `match`, type-level exhaustiveness, compiler entry points, cache, and runtime matcher execution.

## Design Points

1. TypeScript is the primary system: public API, type constraints, cache, and execution all live here.
2. The compiler receives structural rules, not `.to(...)` / `.map(...)` closures.
3. `initMatchPattern()` switches the compiler backend, not the runtime executor.

## Flow Overview

```text
match(value)
  -> createMatcher(...)
  -> patternToAst(...)
  -> CompileProgram
  -> buildCacheKey(...)
  -> compileWithCache(...)
  -> CompilePlan
  -> buildMatcher(...)
  -> matcher(value) -> actionIndex
  -> resolveResult(...)
```

## Code Entry Points

| Change area | Entry point |
|---|---|
| root entry and default engine | `ts/src/index.ts` |
| `when/to/map/otherwise/run/diagnostics` chaining | `ts/src/internal/engine.ts` |
| pattern lowering | `ts/src/internal/predicate.ts` |
| remaining-type and exhaustiveness rules | `ts/src/types.ts` |
| JS compiler, normalization, diagnostics | `ts/src/internal/compiler.ts` |
| runtime execution of `CompilePlan` | `ts/src/internal/runtime.ts` |
| `CompileProgram` / `CompilePlan` types | `ts/src/internal/ast.ts` |
| `advanced` subpath exports | `ts/src/advanced.ts` |

## Layers

### `ts/src/index.ts`

1. Exposes the root API.
2. Owns the default engine.
3. Switches the compiler backend with `initMatchPattern()`.

### `ts/src/types.ts`

1. `Matcher<TData, TResult, TRemaining>` defines the chaining surface.
2. `RemainingByPattern` removes handled cases from the remaining type.
3. `run()` arguments enforce zero-arg exhaustiveness.

### `ts/src/internal/predicate.ts`

1. Literals lower to `eq`.
2. Object patterns lower to `shape`.
3. Built-in predicates already carry AST.
4. Arbitrary JS functions lower to `slot` and get slot ids.

### `ts/src/internal/engine.ts`

1. `createMatcher(...)` accumulates patterns and result entries.
2. `run()` / `diagnostics()` trigger actual compilation.
3. `compileWithCache(...)` resolves cache, precompiled plans, primary compiler, and fallback compiler.
4. `resolveResult(...)` maps `actionIndex` back to `.to(...)` / `.map(...)`.

### `ts/src/internal/compiler.ts`

1. `canonicalizePredicate(...)` performs limited normalization.
2. `compileProgramInJs(...)` turns `CompileProgram` into `CompilePlan`.
3. `covers(...)` implements the current structural shadowing checks.

### `ts/src/internal/runtime.ts`

1. Interprets `CompilePlan`.
2. Scans branches in order.
3. Returns the first matching `actionIndex`.

## Compile Flow

1. `match(data)` creates an empty matcher.
2. Each `when(pattern)` appends a pattern and a result entry.
3. `run()` or `diagnostics()` calls `ensureCompiled()`.
4. `toProgram(...)` lowers the pattern list into `CompileProgram`.
5. `buildCacheKey(...)` computes `stableSerialize({ compilerVersion, program })`.
6. `compileWithCache(...)` checks LRU cache, precompiled plans, primary compiler, then fallback compiler.
7. `buildMatcher(...)` wraps `CompilePlan` as a JS matcher.
8. The matcher returns `actionIndex`.
9. `resolveResult(...)` maps it back to the result value or mapper.

## Design Constraints

| Boundary | Current rule |
|---|---|
| compiler input | `CompileProgram` only; no JS closures |
| cache identity | rule structure + compiler version; not closure identity |
| dynamic predicates | always represented as `slot` |
| branch semantics | branch order is meaningful |
| `shape` | partial by default |
| `exactShape` | the only exact-key path |
| wasm integration | switches `CompileProgram -> CompilePlan`, not the executor |

## Common Sources of Confusion

1. Type-level exhaustiveness comes from `ts/src/types.ts`, not from the Rust compiler.
2. `otherwise(...)` appends an `undefined` pattern, which lowers to a wildcard path.
3. `shape({ type: "pay" })` may canonicalize to `tag` / `tagEq` internally; that does not add new user-facing semantics.
4. `gt(...)` and `lt(...)` end up as `slot`, not as fully provable value-range types.

## Not Implemented

1. No generated JS matcher backend.
2. No decision-tree lowering.
3. No build-time compilation integration.
4. No static analysis for arbitrary JS predicates.

## Checks

1. `yarn test:ts:node`
2. `yarn test:ts:browser`
3. `yarn test:rs:wasm`
4. `yarn verify:rs-pkg`
