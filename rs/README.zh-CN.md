# match-pattern-rs

[English](README.md) | 简体中文

仓库里的 Rust/WASM 包。当前主路径不是执行 matcher，而是把结构化规则编译成 `CompilePlan`。

和 TS 侧的分工如下：

```text
TS 写 DSL 和执行 matcher；
Rust/WASM 提供可选的 compile_plan 编译后端。
```

## 导出接口

| 导出 | 当前用途 |
|---|---|
| `compile_match_plan(program)` | 主路径；把 `CompileProgram` 编译成 `CompilePlan` |
| `match_pattern(data, patterns)` | 旧的运行时 wasm 匹配接口；现在不在 TS 默认 engine 的热路径上 |

TS 集成主路径见 `compile_match_plan(...)`。

## 编译输入与输出

当前主路径是：

```text
CompileProgram -> compile_match_plan(...) -> CompilePlan
```

`CompileProgram` 只包含结构化分支：

1. `actionIndex`
2. `predicate`

`CompilePlan` 当前包含：

1. `version`
2. `branches`
3. `diagnostics`
4. `dynamicSlotCount`

Rust/WASM 不接收 `.to(...)` / `.map(...)` 的 JS 闭包。

## 编译职责

1. 规范化可分析谓词。
2. 把 `PredicateAst` 降成 `CompiledPredicate`。
3. 产出 `CompilePlan`。
4. 给出 `unreachable_branch` 和 `dynamic_slot` 诊断。

## 非目标

1. 不负责 TypeScript 类型收窄。
2. 不负责 `run()` 的穷尽性约束。
3. 不负责执行 `CompilePlan`。
4. 不负责调用 `slot` 对应的 JS 谓词。

## 代码入口

| 路径 | 作用 |
|---|---|
| `rs/src/lib.rs` | wasm 导出入口 |
| `rs/src/compiler.rs` | `CompileProgram -> CompilePlan` |
| `rs/src/matcher.rs` | 旧的 wasm 运行时匹配逻辑 |
| `rs/src/parser.rs` | 旧接口使用的 pattern 解析 |
| `rs/src/types.rs` | 旧接口里的 pattern 类型 |

## 文档索引

1. 整体接入：[ARCHITECTURE.zh-CN.md](ARCHITECTURE.zh-CN.md)
2. TS 默认 engine：[../ts/ARCHITECTURE.zh-CN.md](../ts/ARCHITECTURE.zh-CN.md)
3. 对外使用方式：[../README.zh-CN.md](../README.zh-CN.md)

## 常用命令

```bash
yarn test:rs
yarn test:rs:wasm
yarn rebuild:rs-pkg
yarn verify:rs-pkg
```
