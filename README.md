# match-pattern

English | [简体中文](README.zh-CN.md)

`match-pattern` is a pattern matching library for TypeScript and JavaScript. It is for code that branches on discriminated unions, object shapes, and small runtime guards, where `switch` stops being enough but you still want the cases to stay visible in the code.

It works especially well when you model protocol results and UI states as explicit unions such as `{ success: true, ... } | { success: false, ... }`, and you want those cases checked by the type system instead of being implied by optional fields.

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

In TypeScript, each `when(...)` removes a handled case from the remaining type. `run()` becomes callable once every case has been covered, or you can end with `otherwise(...)` when the match is intentionally open.

## Install

```bash
npm install @weiqu_/match-pattern-ts
```

## Quick Start

1. Import `match` and the predicates you need from the root entry.
2. Add one `when(...)` per branch.
3. Use `run()` when all cases are covered.
4. Use `otherwise(...)` when the match is intentionally open.

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

For non-exhaustive matches, end with `otherwise(...)`:

```ts
import { match, shape } from "@weiqu_/match-pattern-ts";

const classify = (value: unknown) =>
  match(value)
    .when(shape({ status: "ok" }))
    .to("ok")
    .otherwise("unknown");
```

Runtime guards can be combined with structural matching:

```ts
import { and, gt, match, shape, tag } from "@weiqu_/match-pattern-ts";

const route = (event: { type: string; amount?: number }) =>
  match(event)
    .when(and(tag("type", "pay"), shape({ amount: gt(0) })))
    .to("payment-flow")
    .otherwise("ignore");
```

## Examples

### 1. Exhaustive match on a discriminated union

```ts
import { match, tag } from "@weiqu_/match-pattern-ts";

type Result =
  | { success: true; id: string }
  | { success: false; errorMessage: string };

const toMessage = (result: Result) =>
  match(result)
    .when(tag("success", true))
    .map(({ id }) => `ok:${id}`)
    .when(tag("success", false))
    .map(({ errorMessage }) => `error:${errorMessage}`)
    .run();
```

### 2. Partial object match with a fallback

```ts
import { match, shape } from "@weiqu_/match-pattern-ts";

const getBadge = (user: unknown) =>
  match(user)
    .when(shape({ role: "admin" }))
    .to("admin")
    .when(shape({ role: "staff" }))
    .to("staff")
    .otherwise("guest");
```

### 3. Derive values with `map(...)`

```ts
import { match, shape } from "@weiqu_/match-pattern-ts";

const total = (cart: { items?: Array<{ price: number; count: number }> }) =>
  match(cart)
    .when(shape({ items: (items) => Array.isArray(items) && items.length > 0 }))
    .map(({ items }) => items.reduce((sum, item) => sum + item.price * item.count, 0))
    .otherwise(0);
```

### 4. Inspect diagnostics

```ts
import { and, match, shape, tag } from "@weiqu_/match-pattern-ts";

const diagnostics = match({ type: "pay", amount: 10 })
  .when(tag("type", "pay"))
  .to("pay")
  .when(and(tag("type", "pay"), shape({ amount: 10 })))
  .to("specific")
  .diagnostics();

console.log(diagnostics);
```

## Business Scenarios

### 1. WebSocket responses

```ts
import { match, tag } from "@weiqu_/match-pattern-ts";

type WsResponse =
  | { success: true; id: string }
  | { success: false; errorMessage: string };

const toClientMessage = (response: WsResponse) =>
  match(response)
    .when(tag("success", true))
    .map(({ id }) => `connected:${id}`)
    .when(tag("success", false))
    .map(({ errorMessage }) => `error:${errorMessage}`)
    .run();
```

### 2. Access control

```ts
import { and, match, shape } from "@weiqu_/match-pattern-ts";

type AccessContext = {
  role: "owner" | "admin" | "member";
  suspended: boolean;
};

const canManageProject = (ctx: AccessContext) =>
  match(ctx)
    .when(and(shape({ role: "owner" }), shape({ suspended: false })))
    .to(true)
    .when(and(shape({ role: "admin" }), shape({ suspended: false })))
    .to(true)
    .otherwise(false);
```

### 3. Payment status routing

```ts
import { match, tag } from "@weiqu_/match-pattern-ts";

type Payment =
  | { status: "paid"; orderId: string }
  | { status: "pending"; retryAt: string }
  | { status: "failed"; reason: string };

const nextAction = (payment: Payment) =>
  match(payment)
    .when(tag("status", "paid"))
    .to("ship-order")
    .when(tag("status", "pending"))
    .to("wait-and-retry")
    .when(tag("status", "failed"))
    .to("show-error")
    .run();
```

### 4. Complex form submission results

```ts
import { match, shape, tag } from "@weiqu_/match-pattern-ts";

type CheckoutSubmitResult =
  | { ok: true; orderId: string; requires3DS: boolean }
  | {
      ok: false;
      section: "account" | "shipping" | "billing";
      field?: "email" | "confirmPassword" | "country" | "postalCode" | "cardNumber" | "vatId";
      code:
        | "invalid_email"
        | "password_mismatch"
        | "unsupported_region"
        | "invalid_postal_code"
        | "card_declined"
        | "3ds_required"
        | "invalid_vat";
      recoverable: boolean;
      retryable: boolean;
      message: string;
    };

type CheckoutSuccess = Extract<CheckoutSubmitResult, { ok: true }>;
type CheckoutFailure = Extract<CheckoutSubmitResult, { ok: false }>;

const routeSuccess = (result: CheckoutSuccess) =>
  match(result.requires3DS)
    .when(true)
    .to({ kind: "redirect", target: "3ds" as const })
    .when(false)
    .to({ kind: "redirect", target: "confirmation" as const })
    .run();

const routeAccountError = (
  result: Extract<CheckoutFailure, { section: "account" }>,
) =>
  match(result)
    .when(shape({ code: "password_mismatch" }))
    .map(({ message }) => ({
      kind: "inline-error",
      section: "account" as const,
      focus: "confirmPassword" as const,
      text: message,
    }))
    .when(shape({ code: "invalid_email" }))
    .map(({ message }) => ({
      kind: "inline-error",
      section: "account" as const,
      focus: "email" as const,
      text: message,
    }))
    .otherwise({
      kind: "summary",
      section: "account" as const,
      text: "Check account fields",
    });

const routeShippingError = (
  result: Extract<CheckoutFailure, { section: "shipping" }>,
) =>
  match(result.code)
    .when("unsupported_region")
    .to({
      kind: "focus-section",
      section: "shipping" as const,
      focus: "country" as const,
      text: result.message,
    })
    .when("invalid_postal_code")
    .to({
      kind: "focus-section",
      section: "shipping" as const,
      focus: "postalCode" as const,
      text: result.message,
    })
    .otherwise({
      kind: "summary",
      section: "shipping" as const,
      text: result.message,
    });

const routeBillingError = (
  result: Extract<CheckoutFailure, { section: "billing" }>,
) =>
  match(result)
    .when(shape({ code: "card_declined", retryable: true }))
    .map(({ message }) => ({
      kind: "inline-error",
      section: "billing" as const,
      focus: "cardNumber" as const,
      text: message,
    }))
    .when(shape({ recoverable: false }))
    .map(({ message }) => ({
      kind: "block-submit",
      section: "billing" as const,
      text: message,
    }))
    .otherwise({
      kind: "summary",
      section: "billing" as const,
      text: result.message,
    });

const toCheckoutUi = (result: CheckoutSubmitResult) =>
  match(result)
    .when(tag("ok", true))
    .map(routeSuccess)
    .when(shape({ ok: false, section: "account" }))
    .map(routeAccountError)
    .when(shape({ ok: false, section: "shipping" }))
    .map(routeShippingError)
    .when(shape({ ok: false, section: "billing" }))
    .map(routeBillingError)
    .run();
```

## Where It Fits

| Good fit | Less useful |
|---|---|
| discriminated unions, protocol results, event routing, object-shape matching, config-driven rules | plain literal-only `switch` cases, one-off equality checks, control flow that is already clearer as ordinary code |

## What You Write

```ts
match(value)
  .when(pattern)
  .to(result)
  .when(otherPattern)
  .map((input) => nextResult)
  .otherwise(fallback);
```

The main pieces are:

| Area | Available tools |
|---|---|
| structural matching | `shape`, `exactShape`, `tag` |
| predicate composition | `and`, `or`, `not`, `eq`, `wildcard` |
| type-oriented predicates | `isNumber`, `isString`, `isBoolean` |
| runtime guards | `gt`, `lt`, `slot`, custom predicate functions |
| result handling | `.to(...)`, `.map(...)`, `.otherwise(...)`, `.run()` |
| diagnostics | `.diagnostics()` with `unreachable_branch` and `dynamic_slot` |

Common patterns:

| Goal | API |
|---|---|
| branch on discriminated unions | `tag("type", "...")` |
| partial object match | `shape({ ... })` |
| exact key-set match | `exactShape({ ... })` |
| runtime numeric guard | `gt(...)`, `lt(...)` |
| compose conditions | `and(...)`, `or(...)`, `not(...)` |
| non-exhaustive fallback | `otherwise(...)` |
| execute after full coverage | `run()` |

The test suite covers primitive values, arrays, nested objects, discriminated unions, access control, fraud screening, billing retry policies, logistics routing, and config-driven runtime predicates.

## Type Behavior

Static narrowing is intentionally narrower than runtime matching.

1. `tag`, `shape`, `exactShape`, and the built-in type predicates participate in narrowing.
2. `gt`, `lt`, `slot`, and arbitrary predicate functions are runtime filters. They do not claim full exhaustiveness.
3. If TypeScript cannot prove all cases are covered, end with `otherwise(...)`.

```ts
declare const value: string | number;

match(value)
  .when("ok")
  .to("string literal")
  .when(1)
  .to("number literal")
  .otherwise("fallback");
```

## Optional Rust/WASM Compiler

You do not need to initialize anything to use the library. The default compiler is written in JavaScript.

If you want the Rust/WASM compiler path, call `initMatchPattern()`. When initialization succeeds and the wasm module exports `compile_match_plan`, plan compilation moves to Rust/WASM. Matcher execution still stays in JavaScript.

```ts
import { initMatchPattern } from "@weiqu_/match-pattern-ts";

await initMatchPattern();
```

In Node, you can also pass an explicit wasm buffer to `initMatchPattern(...)`. See [`ts/tests/match.node.test.ts`](ts/tests/match.node.test.ts) for a working example.

## Package Surface

| Entry | Intended use |
|---|---|
| `@weiqu_/match-pattern-ts` | application code: `match`, predicates, `otherwise`, `run`, `initMatchPattern` |
| `@weiqu_/match-pattern-ts/advanced` | engine control, slot registry, manual compilation, precompiled plan injection |

```txt
Warning:
`@weiqu_/match-pattern-ts/advanced` is still being iterated on.
Signatures, types, and returned structures may change significantly.
Use it only when you need to own the engine, compile manually, or inject precompiled plans.
```

## Diagnostics

```ts
const diagnostics = match({ type: "pay", amount: 10 })
  .when(tag("type", "pay"))
  .to("pay")
  .when(and(tag("type", "pay"), shape({ amount: 10 })))
  .to("specific")
  .diagnostics();
```

Current diagnostic codes:

1. `unreachable_branch`
2. `dynamic_slot`

## Current Boundaries

1. Compiled plans are executed in JavaScript. The Rust/WASM path is a compiler path, not a native executor.
2. Build-time compilation is not in place yet.
3. Diagnostics exist, but the set is still small.

## Repository Layout

| Path | Role |
|---|---|
| `ts` | TypeScript package: DSL, types, JS compiler, runtime matcher, cache, tests |
| `rs` | Rust compiler package exporting `compile_match_plan` and wasm tests |
| `rs/pkg` | generated npm package consumed by TypeScript |

## Development

```bash
yarn install
yarn build
yarn typecheck
yarn test:ts:node
yarn test:ts:browser
yarn test:rs
yarn test:rs:wasm
yarn verify:rs-pkg
```

Rebuild the generated wasm package after changing Rust exports or bindings:

```bash
yarn rebuild:rs-pkg
```

Additional documentation:

1. [`RELEASING.md`](RELEASING.md)
2. [`MIGRATING-0.3.md`](MIGRATING-0.3.md)
3. [`ts/README.md`](ts/README.md)
4. [`ts/ARCHITECTURE.md`](ts/ARCHITECTURE.md)
5. [`rs/README.md`](rs/README.md)
6. [`rs/ARCHITECTURE.md`](rs/ARCHITECTURE.md)
