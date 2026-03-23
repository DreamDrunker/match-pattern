English | [简体中文](MIGRATING-0.3.zh-CN.md)

# Migrating To 0.3

## Breaking Changes

1. `createMatchEngine` is no longer exported from the root entry.
2. `compileProgramInJs` is no longer exported from the root entry.
3. The package now uses `exports`; undocumented deep import paths are no longer treated as public API.

## Stable Entry

Keep using the root entry for the application-facing DSL:

```ts
import { match, initMatchPattern, shape, tag } from "@weiqu_/match-pattern-ts";
```

## Advanced Entry

Low-level APIs now live under the `advanced` subpath:

```ts
import {
  compileProgramInJs,
  createMatchEngine,
} from "@weiqu_/match-pattern-ts/advanced";
```

## Why This Changed

Starting in `0.3`, the API is split into three layers:

1. Stable: `match`, `initMatchPattern`, and the common predicates.
2. Advanced: custom engines, precompiled plans, and manual compilation.
3. Internal: `internal/*`, compile-plan details, and generated internals.

`advanced` is split out so engine control, precompiled plans, and manual compilation can change without dragging the root entry along with them.

```txt
Warning:
`@weiqu_/match-pattern-ts/advanced` is still being iterated on.
Signatures, types, and returned structures may change significantly.
Use it only when you need to own the engine, compile manually, or inject precompiled plans.
```
