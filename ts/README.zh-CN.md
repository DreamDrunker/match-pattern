# @weiqu_/match-pattern-ts

[English](README.md) | 简体中文

仓库里的 TypeScript 包，也是应用代码真正直接使用的入口。

## 职责

1. 提供 `match(...).when(...).to/map(...).otherwise/run` 这套 DSL。
2. 在类型层维护“剩余未处理分支”，让 `run()` 具备穷尽性约束。
3. 把用户写的 pattern 降成结构化规则，交给 JS 或 Rust/WASM 编译器。
4. 在 JavaScript 里执行 `CompilePlan`，并把命中的 `actionIndex` 映射回结果。

## 概览示例

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

## 使用步骤

1. 从主入口导入 `match` 和需要的谓词。
2. 每个 `when(...)` 对应一个分支。
3. 能证明穷尽时调用 `run()`。
4. 不能证明穷尽时用 `otherwise(...)`。

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

## 更多示例

### 1. 判别联合

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

### 2. 结构匹配

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

## 适用场景

| 适合 | 不适合 |
|---|---|
| 判别联合、对象形状匹配、事件路由、协议返回值、配置驱动规则 | 只有几个字面量分支的普通 `switch`、一次性判断、本来写普通代码更直接的控制流 |

## 包入口

| 入口 | 用途 |
|---|---|
| `@weiqu_/match-pattern-ts` | 应用代码入口；包含 `match`、常用谓词、`initMatchPattern()` |
| `@weiqu_/match-pattern-ts/advanced` | 手动创建 engine、slot registry、直接访问编译器与 AST 类型 |

```txt
注意：
`@weiqu_/match-pattern-ts/advanced` 仍在迭代。
签名、类型、返回结构都可能发生明显变化。
只有在需要自定义 engine、手动编译、注入预编译 plan 时再依赖。
```

## 类型语义与执行职责

| 问题 | 当前归属 |
|---|---|
| 已处理分支是否从联合类型里减掉 | TypeScript 类型系统 |
| `run()` 是否允许无参调用 | TypeScript 类型系统 |
| 规则是否需要编译、缓存、诊断 | runtime engine |
| matcher 是否真的命中某个分支 | JavaScript 运行时 |

## 常用 API

| 需求 | 写法 |
|---|---|
| 判别联合分支 | `tag("type", "...")` |
| 部分对象匹配 | `shape({ ... })` |
| 严格 key 集合匹配 | `exactShape({ ... })` |
| 运行时数值条件 | `gt(...)`、`lt(...)` |
| 多条件组合 | `and(...)`、`or(...)`、`not(...)` |
| 非穷尽兜底 | `otherwise(...)` |
| 完整覆盖后执行 | `run()` |

## WASM 编译路径

默认编译器是 JS。

```ts
import { initMatchPattern } from "@weiqu_/match-pattern-ts";

await initMatchPattern();
```

调用 `initMatchPattern()` 之后，只会切换编译后端：

1. `CompileProgram -> CompilePlan` 可以走 Rust/WASM。
2. `CompilePlan -> matcher(value)` 仍然在 JavaScript 里执行。
3. `slot` 谓词仍然调用 JS 函数。

## 限制

1. 没有 build-time transform。
2. 没有 native wasm 执行热路径。
3. diagnostics 目前只有 `unreachable_branch` 和 `dynamic_slot`。
4. 任意函数谓词不会参与完整静态证明，会落到 `slot`。

## 文档索引

1. 总体介绍：[../README.zh-CN.md](../README.zh-CN.md)
2. TS 侧结构：[ARCHITECTURE.zh-CN.md](ARCHITECTURE.zh-CN.md)
3. Rust/WASM 编译器：[../rs/README.zh-CN.md](../rs/README.zh-CN.md) 和 [../rs/ARCHITECTURE.zh-CN.md](../rs/ARCHITECTURE.zh-CN.md)
