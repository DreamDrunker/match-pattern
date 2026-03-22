# Releasing

## Branches

1. 日常开发进 `dev`。
2. 发版从 `dev` 提一个 release PR 到 `main`。
3. tag 只在 `main` 上打。

## Pre-release Checks

在仓库根目录执行：

```bash
yarn install --frozen-lockfile
yarn typecheck
yarn test:ts:node
yarn test:ts:browser
yarn test:rs
yarn test:rs:wasm
yarn verify:rs-pkg
```

## Generated Package

`rs/pkg` 是生成物，不手改。需要更新时执行：

```bash
yarn rebuild:rs-pkg
```

提交前再跑一次：

```bash
yarn verify:rs-pkg
```

## Version Bump

统一用一个入口改版本：

```bash
yarn version:bump 0.2.1
```

这个命令会同步更新：

1. `ts/package.json`
2. `rs/Cargo.toml`
3. `rs/Cargo.lock`
4. `rs/pkg/package.json`

## Release Flow

1. 从 `dev` 合并 release PR 到 `main`。
2. 在 `main` 打对应 tag，例如 `v0.2.1`。
3. 创建 GitHub Release。
4. `release.yml` 会重新执行验证，再发布 Rust 包和 TS 包。
