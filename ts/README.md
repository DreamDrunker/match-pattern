# @weiqu_/match-pattern-ts

English | [简体中文](README.zh-CN.md)

The TypeScript package used directly by application code.

## Responsibilities

1. Provides the `match(...).when(...).to/map(...).otherwise/run` DSL.
2. Tracks remaining unhandled cases at the type level so `run()` can enforce exhaustiveness.
3. Lowers user-facing patterns into structural rules for the JS or Rust/WASM compiler.
4. Executes `CompilePlan` in JavaScript and maps the matched `actionIndex` back to a result.

## Overview Example

```ts
import { match, shape } from "@weiqu_/match-pattern-ts";

type WsResult =
  | { success: true; id: string }
  | { success: false; errorMessage: string };

const toMessage = (result: WsResult) =>
  match(result)
    .when(shape({ success: true }))
    .map(({ id }) => `connected:${id}`)
    .when(shape({ success: false }))
    .map(({ errorMessage }) => `error:${errorMessage}`)
    .run();
```

## Usage

1. Import `match` and the predicates you need from the root entry.
2. Add one `when(...)` per branch.
3. Call `run()` when the match is exhaustive.
4. Use `otherwise(...)` when it is intentionally open.

```ts
import { match, tag } from "@weiqu_/match-pattern-ts";

type Event =
  | { type: "pay"; orderId: string }
  | { type: "refund"; refundId: string };

const route = (event: Event) =>
  match(event)
    .when(tag("type", "pay"))
    .to("payment-flow")
    .when(tag("type", "refund"))
    .to("refund-flow")
    .run();
```

```ts
import { match, shape } from "@weiqu_/match-pattern-ts";

const classify = (value: unknown) =>
  match(value)
    .when(shape({ status: "ok" }))
    .to("ok")
    .otherwise("unknown");
```

## More Examples

### 1. Discriminated unions

```ts
import { match, tag } from "@weiqu_/match-pattern-ts";

type Event =
  | { type: "pay"; orderId: string }
  | { type: "refund"; refundId: string };

const route = (event: Event) =>
  match(event)
    .when(tag("type", "pay"))
    .to("payment-flow")
    .when(tag("type", "refund"))
    .to("refund-flow")
    .run();
```

### 2. Structural matching

```ts
import { match, shape } from "@weiqu_/match-pattern-ts";

const classify = (value: unknown) =>
  match(value)
    .when(shape({ status: "ok" }))
    .to("ok")
    .otherwise("unknown");
```

### 3. `map(...)`

```ts
import { match, shape } from "@weiqu_/match-pattern-ts";

const total = (cart: { items?: Array<{ price: number; count: number }> }) =>
  match(cart)
    .when(shape({ items: (items) => Array.isArray(items) && items.length > 0 }))
    .map(({ items }) => items.reduce((sum, item) => sum + item.price * item.count, 0))
    .otherwise(0);
```

### 4. `diagnostics()`

```ts
import { and, match, shape, tag } from "@weiqu_/match-pattern-ts";

const diagnostics = match({ type: "pay", amount: 10 })
  .when(tag("type", "pay"))
  .to("pay")
  .when(and(tag("type", "pay"), shape({ amount: 10 })))
  .to("specific")
  .diagnostics();
```

## Good Fit

| Good fit | Less useful |
|---|---|
| discriminated unions, object-shape matching, event routing, protocol results, config-driven rules | small literal-only `switch` statements, one-off checks, control flow that is already clearer as ordinary code |

## Package Surface

| Entry | Intended use |
|---|---|
| `@weiqu_/match-pattern-ts` | application code: `match`, common predicates, `initMatchPattern()` |
| `@weiqu_/match-pattern-ts/advanced` | custom engines, slot registry, direct compiler access, precompiled-plan injection |

```txt
Warning:
`@weiqu_/match-pattern-ts/advanced` is still being iterated on.
Signatures, types, and returned structures may change significantly.
Use it only when you need to own the engine, compile manually, or inject precompiled plans.
```

## Type Semantics and Execution

| Concern | Current owner |
|---|---|
| removing handled cases from a union | TypeScript types |
| deciding whether zero-arg `run()` is valid | TypeScript types |
| compilation, caching, diagnostics | runtime engine |
| actual branch matching | JavaScript runtime |

## Common APIs

| Goal | API |
|---|---|
| branch on discriminated unions | `tag("type", "...")` |
| partial object match | `shape({ ... })` |
| exact key-set match | `exactShape({ ... })` |
| runtime numeric guard | `gt(...)`, `lt(...)` |
| compose conditions | `and(...)`, `or(...)`, `not(...)` |
| non-exhaustive fallback | `otherwise(...)` |
| execute after full coverage | `run()` |

## WASM Compiler Path

The default compiler is JS.

```ts
import { initMatchPattern } from "@weiqu_/match-pattern-ts";

await initMatchPattern();
```

After `initMatchPattern()`:

1. `CompileProgram -> CompilePlan` can use Rust/WASM.
2. `CompilePlan -> matcher(value)` still executes in JavaScript.
3. `slot` predicates still call JavaScript functions.

## Limits

1. No build-time transform.
2. No native wasm execution hot path.
3. Diagnostics are currently limited to `unreachable_branch` and `dynamic_slot`.
4. Arbitrary function predicates do not participate in full static proof; they lower to `slot`.

## Documentation

1. Overview: [../README.md](../README.md)
2. TS architecture: [ARCHITECTURE.md](ARCHITECTURE.md)
3. Rust/WASM compiler: [../rs/README.md](../rs/README.md) and [../rs/ARCHITECTURE.md](../rs/ARCHITECTURE.md)
