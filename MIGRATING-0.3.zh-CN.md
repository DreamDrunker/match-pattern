[English](MIGRATING-0.3.md) | 简体中文

# 迁移到 0.3

## 破坏性变更

1. `createMatchEngine` 不再从主入口导出。
2. `compileProgramInJs` 不再从主入口导出。
3. 包现在声明了 `exports`，未文档化的深层导入路径不再视为公开 API。

## Stable Entry

继续从主入口使用业务 DSL：

```ts
import { match, initMatchPattern, shape, tag } from "@weiqu_/match-pattern-ts";
```

## Advanced Entry

底层能力改为从 `advanced` 子路径导入：

```ts
import {
  compileProgramInJs,
  createMatchEngine,
} from "@weiqu_/match-pattern-ts/advanced";
```

## 为什么改成这样

从 `0.3` 开始，API 分成三层：

1. Stable: `match`、`initMatchPattern`、常用谓词。
2. Advanced: 自定义 engine、预编译计划、手动编译。
3. Internal: `internal/*` 深层结构和生成细节。

`advanced` 单独拆出来，就是为了让 engine 控制、预编译计划和手动编译这类底层接口可以单独调整，不把主入口一起拖进去。

```txt
注意：
`@weiqu_/match-pattern-ts/advanced` 仍在迭代。
签名、类型、返回结构都可能发生明显变化。
普通业务代码谨慎使用；只有在需要自定义 engine、手动编译、注入预编译 plan 时再依赖。
```
