# Migrating To 0.3

## Breaking Changes

1. `createMatchEngine` 不再从主入口导出。
2. `compileProgramInJs` 不再从主入口导出。
3. 包现在声明了 `exports`，未文档化的深层导入路径不再视为公开 API。

## Stable Entry

继续从主入口使用稳定 API：

```ts
import { match, initMatchPattern, shape, tag } from "@weiqu_/match-pattern-ts";
```

## Advanced Entry

高级能力改为从 `advanced` 子路径导入：

```ts
import {
  compileProgramInJs,
  createMatchEngine,
} from "@weiqu_/match-pattern-ts/advanced";
```

## Why This Changed

0.3 开始把 API 分成三层：

1. Stable: `match`、`initMatchPattern`、常用谓词。
2. Advanced: 自定义 engine、预编译计划、手动编译。
3. Internal: `internal/*` 深层结构和生成细节。

这样后续继续做编译优化和计划升级时，不会把普通使用者一起拖进破坏性变更里。
