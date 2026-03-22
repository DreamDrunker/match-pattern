# Wasm 编译器型模式匹配架构说明

## 1. 背景与问题

目标是提供一个“普适、灵活、高频、低延迟”的模式匹配能力，语义接近 Rust `match`，但运行在 JS 环境中。

当前运行时 Wasm 方案的问题是：每次匹配都会跨越 JS/Wasm 边界，并伴随数据转换（lifting/lowering）。对简单判断（如数字判断、常量比较）而言，这部分开销往往比判断逻辑本身更大，因此会出现性能不如纯 JS 的情况。

## 2. 结论

推荐架构：**Wasm 做编译器，JS 做执行器**。

- Wasm/Rust 负责把模式规则编译成高效决策逻辑。
- JS 在热路径上执行“已编译 matcher”，不再每次跨边界。
- 运行时输入仍是灵活的 JS 值/对象，不要求固定 ABI。

这不是“回退到手写 JS 逻辑”，而是“用 Rust 编译器生成并优化 JS matcher”。

## 3. 架构总览

```text
DSL 链式调用 (JS)
  -> 规则 AST (JS)
  -> 结构 hash (JS)
  -> 缓存命中? ----yes----> 直接取 matcher
         | no
         v
   Rust/Wasm 编译核心
     - 归一化
     - 覆盖/冲突检查
     - 决策树优化
     - 代码生成计划
         |
         v
  生成 JS matcher（函数或可解释 IR）
         |
         v
  缓存 matcher
         |
         v
value -> matcher(value) -> branchIndex -> actions[branchIndex](value)
```

## 4. 示例语法的执行过程

输入（示例）：

```js
match(value)
  .when(isNumber()).to(() => console.log("is number"))
  .when(1).to(() => console.log("just 1"));
```

执行链路：

1. DSL 收集阶段：构建规则 AST（包含规则顺序与动作绑定）。
2. 编译阶段（首次或缓存失效时）：
   - 将 `isNumber()` 识别为内建谓词（可下沉为 `typeof v === "number"`）。
   - 分析顺序语义后发现：`when(1)` 被前置 `isNumber()` 覆盖，属于不可达规则。
   - 输出告警（可配置为 warning/error）。
   - 生成 matcher。
3. 运行阶段（高频路径）：
   - `const idx = matcher(value)`（纯 JS）。
   - 若 `idx >= 0`，执行 `actions[idx](value)`。

可能生成的 matcher（简化）：

```js
function matcher(v) {
  if (typeof v === "number") return 0;
  return -1;
}
```

## 5. 性能模型

运行时 Wasm 方案（每次都进 Wasm）：

```text
T = T_边界调用 + T_数据转换 + T_匹配逻辑 + T_返回转换
```

对小匹配，`T_边界调用 + T_数据转换` 常为主导项。

编译器型方案：

- 冷启动（首次）：

```text
T_cold = T_AST + T_编译 + T_实例化 + T_匹配
```

- 热路径（缓存命中）：

```text
T_hot = T_匹配(JS) + T_action分发
```

`T_hot` 通常接近手写 JS 决策代码，不再承担跨 JS/Wasm 边界成本。

## 6. 与“直接手写 JS”相比的收益

1. 语义统一：Rust 风格模式语义在编译器中定义，不依赖人工维护 if/else。
2. 正确性检查：可做穷尽性、不可达分支、冲突规则检查。
3. 自动优化：编译阶段自动重写为决策树/跳转结构。
4. 可演化：模式能力扩展（守卫、解构、嵌套）集中在编译器层实现。
5. 热路径零边界：运行期不需要每次跨 JS/Wasm。

## 7. 灵活性设计（避免固定 ABI）

1. 输入保持 JS 原生值：不要求用户把数据压成 `u32/u64`。
2. 谓词分层：
   - 内建谓词：可编译为内联表达式（最快）。
   - 用户谓词：保留为 JS 函数调用节点（可用但稍慢）。
3. 模式动态化：运行时可接收动态规则；按结构 hash 触发增量编译与缓存。

## 8. 缓存与失效

推荐键设计：

```text
cacheKey = hash(规范化规则结构 + 编译选项 + 编译器版本)
```

注意点：

1. `action` 闭包不参与结构 hash，只用分支索引映射到 action 表。
2. 谓词注册表版本变化时，需触发失效。
3. 采用 LRU 控制 matcher 数量，避免内存无限增长。

## 9. 最小落地方案（MVP）

1. JS 侧：实现 DSL 收集器 + 规范化 AST + cache 管理。
2. Rust/Wasm 侧：实现 AST -> 优化 IR -> 代码生成计划。
3. JS 侧：将计划装配成可执行 matcher（函数或解释器）。
4. 基准测试：
   - 冷启动延迟。
   - 热路径吞吐（ops/s）。
   - 内建谓词 vs 用户谓词开销对比。

## 10. 关键取舍

1. 如果场景极度强调首包和首调用时延，可预编译常用规则。
2. 若运行环境限制 `new Function`（CSP），可切换“IR 解释执行器”路径（牺牲部分性能换兼容性）。
3. 高性能优先时，应鼓励将高频谓词纳入“可编译内建谓词”集合。

## 11. 谓词体系设计

为了同时满足“类型提示、诊断能力、运行时灵活性”，谓词建议分层：

1. `Narrowing Predicate`（收窄型）
   - 作用：改变后续分支可见类型。
   - 示例：`isNumber`、`isString`、`tag("type", "pay")`、`shape(...)`。
2. `Guard Predicate`（过滤型）
   - 作用：只做运行时过滤，不改变类型。
   - 示例：`gt(100)`、`lt(0)`、`regex(...)`。
3. `Dynamic Slot Predicate`（动态槽位）
   - 作用：作为无法静态分析谓词的兜底。
   - 示例：`slot(runtimeRule)`、任意闭包逻辑。

建议首版支持的谓词集合：

1. 基础类型：`isNumber`、`isString`、`isBoolean`、`isNull`、`isUndefined`
2. 字面量/集合：`eq`、`lit`、`inSet`
3. 结构：`shape`（partial）、`exactShape`（严格匹配）
4. 判别联合：`tag`
5. 组合：`and`、`or`、`not`
6. 动态回调：`slot`

## 12. 与 TypeScript 类型系统的配合边界

结论：不是“所有谓词都能完美收窄”，而是“收窄型谓词可强配合，过滤型谓词保持原类型”。

### 12.1 可强配合（推荐）

1. `isXxx`、`tag`、`shape` 等收窄型谓词可驱动后续分支类型收窄。
2. `match` 的类型定义可维护“剩余类型（Remaining Type）”，每个 `when` 成功后从剩余类型中减去已命中集合。

示例：

```ts
declare const value: string | number;

match(value)
  .when(isNumber()).to(v => v.toFixed(2))   // v: number
  .when(isString()).to(v => v.toUpperCase()) // v: string
```

### 12.2 不做额外收窄（也合理）

`gt(100)` 这类谓词只做过滤，不需要引入额外类型精化：

```ts
declare const n: number;

match(n)
  .when(gt(100)).to(v => {
    // v: number
    return v;
  })
  .when(lt(0)).to(v => {
    // v 仍然是 number
    return v;
  });
```

这类规则的价值在运行时过滤与潜在优化，不在类型层表达“值域约束”。

### 12.3 无法静态分析的谓词

1. 任意闭包、外部状态依赖、反射式逻辑通常无法可靠静态分析。
2. 这类谓词走 `slot`，类型侧不强收窄，诊断侧可标记 `Unknown`。

## 13. 为什么需要 `tag`

`shape({ type: "pay" })` 或 `{ type: "pay" }` 在语义上可以表达“字段相等”，但 `tag("type", "pay")` 额外表达了“判别联合意图”。

`tag` 的价值：

1. 语义明确：该字段被视为 union discriminator。
2. 优化友好：多个 `tag("type", "...")` 可稳定编译为 `switch(v.type)`。
3. 诊断更强：可做穷尽、遮蔽、非法 tag 值检查。
4. 类型收窄更强：可直接映射为 `Extract<U, { type: "pay" }>`。

推荐用户体验：

1. 允许 `.when({ type: "pay" })` 和 `.when(shape({ type: "pay" }))` 作为语法糖。
2. 编译器内部 canonicalize 为 `tag("type", "pay")`（满足判别联合条件时）。

## 14. 深对象的穷尽与遮蔽诊断

任意 JS 谓词的完整穷尽证明不可判定，因此策略是：

1. 对可分析谓词子集（`tag/shape/eq/and/or/not`）做严格集合分析。
2. 对动态槽位谓词降级为 `Unknown`，给出保守诊断。

深对象诊断流程：

1. 将规则转成路径约束（例如 `payload.kind == "A"`、`user.vip == true`）。
2. 按分支顺序做集合减法：`Remaining = Remaining - Branch`。
3. 交集为空的分支判定为不可达/被遮蔽。
4. 所有分支后 `Remaining` 非空则判定为非穷尽，并给出 witness（反例对象）。

`shape` 语义建议：

1. `shape` 默认 partial（允许额外字段）。
2. `exactShape` 才要求严格字段一致。

这一区分会直接影响遮蔽判断结果。

## 15. 诊断能力在 SWC 与 Fallback 下的表现

编译诊断、优化报告、规则 lint 并不依赖 SWC 本身，而是来自统一的 Rust 编译核心。

两种接入路径差异：

1. SWC 路径
   - 构建期给出诊断。
   - 源码位置信息更精确，适合 CI 和 IDE 报告。
2. Runtime fallback 路径
   - 首次编译时也能产出诊断与优化报告。
   - 位置信息通常较弱，但语义诊断能力可保持一致。
