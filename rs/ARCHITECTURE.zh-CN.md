# 架构

[English](ARCHITECTURE.md) | 简体中文

适用范围：Rust/WASM 编译器。

## 设计要点

1. `rs` 侧当前主路径是编译器，不是执行器。
2. TS 默认 engine 只调用 `compile_match_plan(...)`。
3. `CompilePlan` 的执行仍然发生在 JavaScript。

## 流程概览

```text
TS matcher
  -> CompileProgram
  -> compile_match_plan(...)
  -> CompilePlan
  -> JS buildMatcher(...)
  -> matcher(value) -> actionIndex
```

## 代码入口

| 改动方向 | 入口 |
|---|---|
| wasm 导出和序列化边界 | `rs/src/lib.rs` |
| 主编译逻辑 | `rs/src/compiler.rs` |
| 旧的运行时匹配接口 | `rs/src/matcher.rs` |
| 旧接口的 pattern 解析 | `rs/src/parser.rs` |
| 旧接口类型 | `rs/src/types.rs` |

## 主路径和旧路径

### 主路径

现在和 TS 默认 engine 接上的，是这条：

```text
CompileProgram -> compile_match_plan(...) -> CompilePlan
```

`compile_match_plan(...)` 的职责很窄：

1. 反序列化 `CompileProgram`。
2. 调用 `compile_program(...)`。
3. 把结果序列化回 JS 可消费的 `CompilePlan`。

### 旧路径

`match_pattern(data, patterns)` 仍然导出，但不在当前 TS 默认 engine 的执行热路径上。

保留用途：

1. wasm 侧旧接口测试。
2. 低层调试。
3. 保留一条直接在 wasm 里按 pattern 试匹配的路径。

## `compiler.rs` 的职责

当前编译路径包括 4 步：

1. `canonicalize_predicate(...)`
2. `lower_predicate(...)`
3. 生成 `CompiledBranch`
4. 生成 `CompilePlan` 和诊断

当前输出的 `CompilePlan` 包含：

1. `version`
2. `branches`
3. `diagnostics`
4. `dynamic_slot_count`

## 与 TS 编译器的一致性约束

`rs/src/compiler.rs` 和 `ts/src/internal/compiler.ts` 是一对行为对齐实现。

至少要保持下面这些东西一致：

| 项目 | 要求 |
|---|---|
| `CompilePlan` 结构 | 一致 |
| 规范化规则 | 一致 |
| `shape -> tagEq` 的条件 | 一致 |
| `and` / `or` 拍平 | 一致 |
| `wildcard -> true` | 一致 |
| `unreachable_branch` 触发条件 | 一致 |
| `dynamic_slot` 触发条件 | 一致 |

改 Rust 侧时，默认要把 TS 侧一起对一遍。

## 设计约束

| 边界 | 当前规则 |
|---|---|
| 编译器输入 | 只能看到结构化 `CompileProgram` |
| action | 只能看到 `actionIndex`，看不到 JS 闭包 |
| 动态谓词 | 保留为 `slot` |
| 执行器 | 不在 Rust/WASM 里 |
| 类型穷尽性 | 不在 Rust/WASM 里 |

## 未实现项

1. 没有 wasm native matcher 热路径。
2. 没有生成式代码执行器。
3. 没有 build-time 集成。
4. 没有对任意 JS predicate 的完整静态证明。
5. 没有 benchmark 支撑的性能结论文档。

## 相关测试

1. `rs/tests/browser.rs`
2. `ts/tests/compiler-parity.node.test.ts`
3. `ts/tests/engine.node.test.ts`
