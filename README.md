# match-pattern-monorepo

面向 JavaScript/TypeScript 的模式匹配库 Monorepo。

当前仓库已经落地的范围：

1. TypeScript API，包含穷尽性类型约束。
2. Rust/WASM 编译计划入口，可由 TS 侧初始化后接入。
3. JS 编译器回退路径，未初始化 WASM 时默认可用。

当前还没落地到位的范围：

1. 决策树级别的编译优化。
2. 构建期接入，例如 SWC / 预编译 transform。
3. benchmark 基线与性能结论。

## 0.3 API 边界

1. Stable：`match`、`initMatchPattern`、常用谓词。
2. Advanced：`@weiqu_/match-pattern-ts/advanced`，包含 `createMatchEngine`、`compileProgramInJs`。
3. Internal：`internal/*`、compile plan 细节、生成物细节，不视为公开 API。

## 包结构

- `ts`：`@weiqu_/match-pattern-ts`
  - 对外 API：`match(...)`、`initMatchPattern(...)`
  - 谓词能力：`tag`、`shape`、`exactShape`、`and`、`or`、`not`、`isNumber`、`isString`、`gt`、`lt` 等
  - 内含运行时引擎、编译回退、缓存、诊断与测试
- `rs`：Rust 核心包（`match-pattern-rs`）
  - 导出 WASM 函数（包含 `compile_match_plan`）
- `rs/pkg`：由 Rust 产出的 WASM npm 包（`@weiqu_/match-pattern-rs`），供 TS 侧加载

## 快速开始

```bash
yarn install --frozen-lockfile
yarn build
yarn typecheck
yarn test:ts:node
yarn test:ts:browser
yarn test:rs

# 需要验证 wasm 测试和生成物时
yarn test:rs:wasm
yarn verify:rs-pkg
```

## 业务侧使用

### 1) 初始化（可选但推荐）

浏览器环境：

```ts
import { initMatchPattern } from "@weiqu_/match-pattern-ts";

await initMatchPattern();
```

Node 环境（可显式传入 wasm 二进制）：

```ts
import { readFile } from "fs/promises";
import { createRequire } from "module";
import { dirname, join } from "path";
import { initMatchPattern } from "@weiqu_/match-pattern-ts";

const require = createRequire(import.meta.url);
const pkgPath = dirname(require.resolve("@weiqu_/match-pattern-rs"));
const wasmBuffer = new Uint8Array(await readFile(join(pkgPath, "match_pattern_rs_bg.wasm")));

await initMatchPattern(wasmBuffer);
```

初始化成功且导出了 `compile_match_plan` 时，编译计划会优先走 Rust/WASM；  
否则会自动回退到 JS 编译器。

### 1.1) 高级入口

如果你要自定义 engine 或手动编译计划，改用：

```ts
import {
  compileProgramInJs,
  createMatchEngine,
} from "@weiqu_/match-pattern-ts/advanced";
```

### 2) 使用 `match` API

```ts
import { and, gt, match, shape, tag } from "@weiqu_/match-pattern-ts";

type Event =
  | { type: "pay"; amount: number }
  | { type: "refund"; refundId: string };

const route = (event: Event) =>
  match(event)
    .when(and(tag("type", "pay"), shape({ amount: gt(0) })))
    .to("payment-flow")
    .when(tag("type", "refund"))
    .to("refund-flow")
    .otherwise("ignore");
```

### 3) 使用 `map` 派生结果

```ts
const total = match(cart)
  .when(shape({ items: (items) => Array.isArray(items) && items.length > 0 }))
  .map(({ items }) => items.reduce((sum, item) => sum + item.price * item.count, 0))
  .otherwise(0);
```

## 穷尽性规则（重要）

该 API 会在 TypeScript 能证明的范围内尽量做穷尽性约束。

- `run()` 只允许在分支穷尽后调用（或先调用 `otherwise(...)`）。
- 分支不穷尽时，`run()` 会出现类似 TS 报错：
  - `Expected 1 arguments, but got 0`
- 已经穷尽后继续添加 `when(...)`，其参数类型会收窄为 `never`。

### 字面量类型与宽类型

```ts
match(true).when(false); // 编译错误：false 不能赋值给 Pattern<true>
```

但如果是宽类型：

```ts
const b: boolean = Math.random() > 0.5;
match(b).when(false).to("f").run(); // 非穷尽，需要补 when(true) 或 otherwise
```

### 有限联合对象可实现完整穷尽

```ts
const obj = Math.random() > 0.5 ? ({ a: 1 } as const) : ({ b: 2 } as const);

match(obj)
  .when(shape({ a: 1 }))
  .to("a")
  .when(shape({ b: 2 }))
  .to("b")
  .run(); // 穷尽
```

### 谓词穷尽性注意点

`gt` / `lt` / `slot` / 普通函数等运行时谓词会被保守处理，主要用于运行时过滤，不会像字面量分支那样完整参与穷尽性推导。

## 谓词能力总览

- 类型谓词：`isNumber()`、`isString()`、`isBoolean()`、`isNull()`、`isUndefined()`
- 值谓词：`eq(value)`、`tag(key, value)`
- 结构谓词：`shape(fields)`（部分匹配）、`exactShape(fields)`（严格 key 集合）
- 组合谓词：`and(...)`、`or(...)`、`not(...)`
- 运行时槽位：`slot(fn)`、`gt(limit)`、`lt(limit)`
- 通配：`wildcard()`

## 运行时与编译流程

1. `match(...).when(...).to(...)` 组装谓词程序。
2. 引擎基于编译器版本 + 规范化程序生成缓存键。
3. 编译计划来源：
   - 优先 WASM 的 `compile_match_plan`（已初始化且可用时）
   - 否则回退到 JS 的 `compileProgramInJs`
4. 编译计划进入 LRU 缓存。
5. 运行时 matcher 执行已编译谓词并返回命中分支下标。
6. 最终解析 `.to(...)` / `.map(...)` 对应结果。

## 诊断与调试

可通过 `.diagnostics()` 查看编译诊断信息：

- `unreachable_branch`
- `dynamic_slot`

示例：

```ts
const diagnostics = match(input)
  .when(tag("type", "pay"))
  .to("a")
  .when(tag("type", "pay"))
  .to("b")
  .diagnostics();
```

## 常用测试命令

```bash
yarn typecheck
yarn test:ts:node
yarn test:ts:browser
yarn test:rs
yarn test:rs:wasm
yarn verify:rs-pkg
```

## 额外文档

- 架构说明：`rs/docs/wasm-compiler-match-architecture.md`
- 发版流程：`RELEASING.md`
- 0.3 迁移：`MIGRATING-0.3.md`
