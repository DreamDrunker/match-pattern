# match-pattern

[English](README.md) | 简体中文

`match-pattern` 是一个面向 TypeScript 和 JavaScript 的模式匹配库，适用于判别联合、对象形状匹配和少量运行时 guard。典型场景是：`switch` 已经不够用，但分支语义又不希望拆散到零散 helper 和 predicate 里。

显式状态建模尤其合适：`{ success: true, ... } | { success: false, ... }`。分支是类型系统里的真实分支，不再靠可选字段和约定去猜。

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

在 TypeScript 里，每个 `when(...)` 都会从“剩余未处理分支”里减掉一部分，所以只有在所有情况都处理完之后，`run()` 才能无参调用；如果匹配本来就是开放的，就用 `otherwise(...)` 收尾。

## 安装

```bash
npm install @weiqu_/match-pattern-ts
```

## 快速开始

1. 从主入口导入 `match` 和需要的谓词。
2. 每个 `when(...)` 写一个分支。
3. 全部分支都覆盖时用 `run()`。
4. 只想兜底时用 `otherwise(...)`。

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

非穷尽匹配时，用 `otherwise(...)` 收尾：

```ts
import { match, shape } from "@weiqu_/match-pattern-ts";

const classify = (value: unknown) =>
  match(value)
    .when(shape({ status: "ok" }))
    .to("ok")
    .otherwise("unknown");
```

运行时 guard 可以和结构匹配组合：

```ts
import { and, gt, match, shape, tag } from "@weiqu_/match-pattern-ts";

const route = (event: { type: string; amount?: number }) =>
  match(event)
    .when(and(tag("type", "pay"), shape({ amount: gt(0) })))
    .to("payment-flow")
    .otherwise("ignore");
```

## 示例

### 1. 判别联合穷尽匹配

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

### 2. 部分对象匹配 + 兜底

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

### 3. 用 `map(...)` 派生结果

```ts
import { match, shape } from "@weiqu_/match-pattern-ts";

const total = (cart: { items?: Array<{ price: number; count: number }> }) =>
  match(cart)
    .when(shape({ items: (items) => Array.isArray(items) && items.length > 0 }))
    .map(({ items }) => items.reduce((sum, item) => sum + item.price * item.count, 0))
    .otherwise(0);
```

### 4. 查看诊断

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

## 业务场景示例

### 1. websocket 返回值

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

### 2. 权限判断

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

### 3. 支付状态路由

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

### 4. 复杂表单提交结果

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

## 适用场景

| 适合 | 不太适合 |
|---|---|
| 判别联合、协议返回值、事件路由、对象形状匹配、配置驱动规则 | 只有字面量分支的普通 `switch`、一次性的相等判断、本来用普通代码就更清楚的控制流 |

## 写法

```ts
match(value)
  .when(pattern)
  .to(result)
  .when(otherPattern)
  .map((input) => nextResult)
  .otherwise(fallback);
```

主入口能力如下：

| 方面 | 可用工具 |
|---|---|
| 结构匹配 | `shape`、`exactShape`、`tag` |
| 谓词组合 | `and`、`or`、`not`、`eq`、`wildcard` |
| 类型导向谓词 | `isNumber`、`isString`、`isBoolean` |
| 运行时 guard | `gt`、`lt`、`slot`、自定义谓词函数 |
| 结果处理 | `.to(...)`、`.map(...)`、`.otherwise(...)`、`.run()` |
| 诊断 | `.diagnostics()`，当前包含 `unreachable_branch` 和 `dynamic_slot` |

常见写法：

| 需求 | 写法 |
|---|---|
| 判别联合分支 | `tag("type", "...")` |
| 部分对象匹配 | `shape({ ... })` |
| 严格 key 集合匹配 | `exactShape({ ... })` |
| 运行时数值条件 | `gt(...)`、`lt(...)` |
| 多条件组合 | `and(...)`、`or(...)`、`not(...)` |
| 非穷尽兜底 | `otherwise(...)` |
| 完整覆盖后执行 | `run()` |

现有测试已经覆盖基础值、数组、嵌套对象、判别联合、访问控制、风控、支付失败重试、物流分流，以及配置驱动的运行时规则。

## 类型行为

静态收窄和运行时匹配不是一回事，这里是刻意分层的。

1. `tag`、`shape`、`exactShape` 以及内建类型谓词会参与类型收窄。
2. `gt`、`lt`、`slot` 和任意函数谓词主要是运行时过滤条件，不会假装自己能证明穷尽。
3. TypeScript 无法证明穷尽时，就用 `otherwise(...)` 收尾。

```ts
declare const value: string | number;

match(value)
  .when("ok")
  .to("string literal")
  .when(1)
  .to("number literal")
  .otherwise("fallback");
```

## 可选的 Rust/WASM 编译器

直接使用库时不需要额外初始化，默认编译器就是 JavaScript 版本。

如果你要启用 Rust/WASM 编译路径，调用 `initMatchPattern()` 即可。初始化成功且 wasm 模块导出了 `compile_match_plan` 之后，规则计划会优先走 Rust/WASM 编译；真正执行 matcher 时，仍然留在 JavaScript 里。

```ts
import { initMatchPattern } from "@weiqu_/match-pattern-ts";

await initMatchPattern();
```

在 Node 里也可以把 wasm buffer 显式传给 `initMatchPattern(...)`。可直接参考 [`ts/tests/match.node.test.ts`](ts/tests/match.node.test.ts) 里的可运行示例。

## 包入口

| 入口 | 用途 |
|---|---|
| `@weiqu_/match-pattern-ts` | 应用代码入口：`match`、谓词、`otherwise`、`run`、`initMatchPattern` |
| `@weiqu_/match-pattern-ts/advanced` | engine 控制、slot registry、手动编译、预编译 plan 注入 |

```txt
注意：
`@weiqu_/match-pattern-ts/advanced` 仍在迭代。
签名、类型、返回结构都可能发生明显变化。
普通业务代码谨慎使用；只有在需要自定义 engine、手动编译、注入预编译 plan 时再依赖。
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

当前诊断码：

1. `unreachable_branch`
2. `dynamic_slot`

## 限制

1. `CompilePlan` 的执行仍然在 JavaScript 里，Rust/WASM 目前只负责编译路径。
2. 还没有 build-time 编译接入。
3. diagnostics 已经可用，但集合还不大。

## 仓库结构

| 路径 | 作用 |
|---|---|
| `ts` | TypeScript 包：DSL、类型系统、JS compiler、runtime matcher、缓存、测试 |
| `rs` | Rust compiler 包，导出 `compile_match_plan` 和 wasm 测试 |
| `rs/pkg` | Rust 生成的 npm 包，供 TS 侧加载 |

## 开发

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

Rust 导出或 wasm 绑定发生变化后，重新生成 `rs/pkg`：

```bash
yarn rebuild:rs-pkg
```

其他文档：

1. [`RELEASING.zh-CN.md`](RELEASING.zh-CN.md)
2. [`MIGRATING-0.3.zh-CN.md`](MIGRATING-0.3.zh-CN.md)
3. [`ts/README.zh-CN.md`](ts/README.zh-CN.md)
4. [`ts/ARCHITECTURE.zh-CN.md`](ts/ARCHITECTURE.zh-CN.md)
5. [`rs/README.zh-CN.md`](rs/README.zh-CN.md)
6. [`rs/ARCHITECTURE.zh-CN.md`](rs/ARCHITECTURE.zh-CN.md)
