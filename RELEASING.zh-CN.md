[English](RELEASING.md) | 简体中文

# 发版

## 分支

1. 日常开发进 `dev`。
2. 发版从 `dev` 提一个 release PR 到 `main`。
3. tag 只在 `main` 上打。

## 发版前检查

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

## 生成包

`rs/pkg` 是生成物，不手改。需要更新时执行：

```bash
yarn rebuild:rs-pkg
```

提交前再跑一次：

```bash
yarn verify:rs-pkg
```

## 版本号

统一用一个入口改版本：

```bash
yarn version:bump 0.2.1
```

这个命令会同步更新：

1. `ts/package.json`
2. `rs/Cargo.toml`
3. `rs/Cargo.lock`
4. `rs/pkg/package.json`

## 发版流程

1. 从 `dev` 合并 release PR 到 `main`。
2. 在 `main` 打对应 tag，例如 `v0.2.1`。
3. 把 tag 推到远程，例如 `git push origin v0.2.1`。
4. `release.yml` 会重新执行验证，发布 Rust 包和 TS 包，并自动创建或更新 GitHub Release。

如果已有版本需要补发，不用重新推 tag，直接从要发布的 ref 手动触发 workflow，并填入 tag 名称即可。

## Trusted Publishing

发布现在走 npm Trusted Publishing，通过 GitHub Actions OIDC 完成。

npmjs.com 里需要分别给这两个包配置 trusted publisher：

1. `@weiqu_/match-pattern-rs`
2. `@weiqu_/match-pattern-ts`

两个包都填同一组 GitHub Actions 信息：

1. Organization or user: `DreamDrunker`
2. Repository: `match-pattern`
3. Workflow filename: `release.yml`

这条 release workflow 支持两种触发方式：

1. 正常发版：push tag
2. 补发已有版本：workflow_dispatch + tag 输入
