# 架构

[English](ARCHITECTURE.md) | 简体中文

适用范围：`match`、类型层、编译入口、缓存、运行时 matcher。

## 设计要点

1. TS 侧是主系统；用户 API、类型约束、缓存、执行都在这里。
2. 编译器只接收结构化规则，不接收 `.to(...)` / `.map(...)` 里的闭包。
3. `initMatchPattern()` 只切编译后端，不切执行后端。

## 流程概览

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

## 代码入口

| 改动方向 | 入口 |
|---|---|
| 主入口和默认 engine | `ts/src/index.ts` |
| `when/to/map/otherwise/run/diagnostics` 的串接 | `ts/src/internal/engine.ts` |
| pattern 怎么降成 AST | `ts/src/internal/predicate.ts` |
| 类型上的剩余分支与穷尽性 | `ts/src/types.ts` |
| JS 编译器、规范化、诊断 | `ts/src/internal/compiler.ts` |
| `CompilePlan` 的运行时执行 | `ts/src/internal/runtime.ts` |
| `CompileProgram` / `CompilePlan` 类型 | `ts/src/internal/ast.ts` |
| advanced 子路径导出 | `ts/src/advanced.ts` |

## 代码分层

### 1. `ts/src/index.ts`

1. 暴露根入口 API。
2. 维护默认 engine。
3. 用 `initMatchPattern()` 切换编译后端。

### 2. `ts/src/types.ts`

1. `Matcher<TData, TResult, TRemaining>` 定义链式 API。
2. `RemainingByPattern` 负责从剩余类型里减去已命中分支。
3. `run()` 的参数约束决定“非穷尽时不能无参调用”。

### 3. `ts/src/internal/predicate.ts`

1. 字面量变成 `eq`。
2. 对象 pattern 变成 `shape`。
3. 内建谓词直接携带 AST。
4. 任意 JS 函数变成 `slot`，并在 slot registry 里注册编号。

### 4. `ts/src/internal/engine.ts`

1. `createMatcher(...)` 先收集 pattern 和 result entry。
2. `run()` / `diagnostics()` 才触发真正编译。
3. `compileWithCache(...)` 负责 cache、预编译 plan、主编译器、回退编译器。
4. `resolveResult(...)` 用 `actionIndex` 找回 `.to(...)` / `.map(...)` 的结果。

### 5. `ts/src/internal/compiler.ts`

1. `canonicalizePredicate(...)` 做小范围规范化。
2. `compileProgramInJs(...)` 把 `CompileProgram` 变成 `CompilePlan`。
3. `covers(...)` 做当前这版可证明的遮蔽判断。

### 6. `ts/src/internal/runtime.ts`

1. 解释执行 `CompilePlan`。
2. 按分支顺序逐条匹配。
3. 返回第一个命中的 `actionIndex`。

## 编译流程

1. `match(data)` 创建一个空 matcher。
2. 每个 `when(pattern)` 都追加 pattern 和 result entry。
3. `run()` 或 `diagnostics()` 调用 `ensureCompiled()`。
4. `toProgram(...)` 把 pattern 列表降成 `CompileProgram`。
5. `buildCacheKey(...)` 计算 `stableSerialize({ compilerVersion, program })`。
6. `compileWithCache(...)` 依次查 LRU cache、预编译 plan、主编译器、回退编译器。
7. `buildMatcher(...)` 把 `CompilePlan` 包成 JS matcher。
8. matcher 返回 `actionIndex`。
9. `resolveResult(...)` 再映射回结果值或 mapper。

## 设计约束

| 边界 | 当前规则 |
|---|---|
| 编译器输入 | 只能看到 `CompileProgram`，不能看到 JS 闭包 |
| cache identity | 只依赖规则结构和编译器版本，不依赖闭包 identity |
| 动态谓词 | 统一走 `slot` |
| 分支语义 | 顺序有意义，不能重排 |
| `shape` | 默认 partial |
| `exactShape` | 才是严格 key 集合匹配 |
| wasm 接入 | 只切换 `CompileProgram -> CompilePlan`，不切换执行器 |

## 易混边界

1. 类型穷尽性不来自 Rust 编译器，来自 `ts/src/types.ts`。
2. `otherwise(...)` 本质上是追加一个 `undefined` pattern，也就是 wildcard。
3. `shape({ type: "pay" })` 在编译阶段可能规范化成 `tag` / `tagEq`，但这只是内部形式，不是新的用户语义。
4. `gt(...)`、`lt(...)` 这种 helper 最终也是 `slot`，不会变成可完整证明的值域类型。

## 未实现项

1. 没有生成式 JS matcher。
2. 没有决策树 lowering。
3. 没有 build-time 编译接入。
4. 没有对任意 JS predicate 做静态分析。

## 相关检查

1. `yarn test:ts:node`
2. `yarn test:ts:browser`
3. `yarn test:rs:wasm`
4. `yarn verify:rs-pkg`
