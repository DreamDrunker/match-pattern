English | [简体中文](RELEASING.zh-CN.md)

# Releasing

## Branches

1. Day-to-day development goes into `dev`.
2. Release PRs go from `dev` to `main`.
3. Tags are created only on `main`.

## Pre-release Checks

Run these commands from the repository root:

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

`rs/pkg` is generated output and should not be edited by hand. Rebuild it with:

```bash
yarn rebuild:rs-pkg
```

Run this again before pushing:

```bash
yarn verify:rs-pkg
```

## Version Bump

Use a single command to bump versions:

```bash
yarn version:bump 0.2.1
```

It updates all of these files together:

1. `ts/package.json`
2. `rs/Cargo.toml`
3. `rs/Cargo.lock`
4. `rs/pkg/package.json`

## Release Flow

1. Merge the release PR from `dev` into `main`.
2. Create the release tag on `main`, for example `v0.2.1`.
3. Create the GitHub Release.
4. `release.yml` reruns verification and then publishes the Rust and TypeScript packages.

## Trusted Publishing

Publishing now uses npm trusted publishing through GitHub Actions OIDC.

Package-side setup on npmjs.com is required for both packages:

1. `@weiqu_/match-pattern-rs`
2. `@weiqu_/match-pattern-ts`

Use the same GitHub Actions publisher settings for both:

1. Organization or user: `DreamDrunker`
2. Repository: `match-pattern`
3. Workflow filename: `release.yml`

After trusted publishing works, token-based publishing should stay disabled for this workflow.
