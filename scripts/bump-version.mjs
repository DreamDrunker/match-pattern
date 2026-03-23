import { readFile, writeFile } from "node:fs/promises";

const [, , nextVersion] = process.argv;

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const assertVersion = (value) =>
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value) ||
  fail(`invalid version: ${value ?? "<missing>"}`);

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const writeJson = async (path, value) =>
  writeFile(path, `${JSON.stringify(value, null, 2)}\n`);

const replaceOrFail = (source, matcher, replacer, label) => {
  if (!matcher.test(source)) {
    fail(`failed to update ${label}`);
  }
  return source.replace(matcher, replacer);
};

assertVersion(nextVersion);

const tsPackagePath = new URL("../ts/package.json", import.meta.url);
const rsPackagePath = new URL("../rs/pkg/package.json", import.meta.url);
const cargoTomlPath = new URL("../rs/Cargo.toml", import.meta.url);
const cargoLockPath = new URL("../rs/Cargo.lock", import.meta.url);

const tsPackage = await readJson(tsPackagePath);
const rsPackage = await readJson(rsPackagePath);
const cargoToml = await readFile(cargoTomlPath, "utf8");
const cargoLock = await readFile(cargoLockPath, "utf8");

tsPackage.version = nextVersion;
tsPackage.dependencies["@weiqu_/match-pattern-rs"] = `^${nextVersion}`;
rsPackage.version = nextVersion;

const nextCargoToml = replaceOrFail(
  cargoToml,
  /^version = ".*"$/m,
  `version = "${nextVersion}"`,
  "rs/Cargo.toml",
);

const nextCargoLock = replaceOrFail(
  cargoLock,
  /(name = "match-pattern-rs"\nversion = ")([^"]+)(")/,
  `$1${nextVersion}$3`,
  "rs/Cargo.lock",
);

await Promise.all([
  writeJson(tsPackagePath, tsPackage),
  writeJson(rsPackagePath, rsPackage),
  writeFile(cargoTomlPath, nextCargoToml),
  writeFile(cargoLockPath, nextCargoLock),
]);
