import type {
  CompileBranch,
  CompileDiagnostic,
  CompilePlan,
  CompileProgram,
  CompiledPredicate,
  MatchValue,
  PredicateAst,
} from "./ast";
import { deepEqual } from "./object";

const COMPILE_PLAN_VERSION = 1;
type TypeOfValue = Extract<CompiledPredicate, { kind: "typeOf" }>["value"];

const assertNever = (value: never): never => {
  throw new Error(`unexpected variant: ${JSON.stringify(value)}`);
};

const matchesType = (
  typeName: TypeOfValue,
  value: MatchValue,
): boolean => {
  switch (typeName) {
    case "number":
      return typeof value === "number";
    case "string":
      return typeof value === "string";
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return typeof value === "object" && value !== null;
    default:
      return false;
  }
};

const lowerPredicate = (predicate: PredicateAst): CompiledPredicate => {
  switch (predicate.kind) {
    case "isNumber":
      return { kind: "typeOf", value: "number" };
    case "isString":
      return { kind: "typeOf", value: "string" };
    case "isBoolean":
      return { kind: "typeOf", value: "boolean" };
    case "isNull":
      return { kind: "isNull" };
    case "isUndefined":
      return { kind: "isUndefined" };
    case "eq":
      return { kind: "eq", value: predicate.value };
    case "tag":
      return { kind: "tagEq", key: predicate.key, value: predicate.value };
    case "shape":
      return {
        kind: "shape",
        exact: Boolean(predicate.exact),
        fields: Object.fromEntries(
          Object.entries(predicate.fields).map(([key, node]) => [
            key,
            lowerPredicate(node),
          ]),
        ),
      };
    case "and":
      return {
        kind: "and",
        predicates: predicate.predicates.flatMap((item) => {
          const lowered = lowerPredicate(item);
          return lowered.kind === "and" ? lowered.predicates : [lowered];
        }),
      };
    case "or":
      return {
        kind: "or",
        predicates: predicate.predicates.flatMap((item) => {
          const lowered = lowerPredicate(item);
          return lowered.kind === "or" ? lowered.predicates : [lowered];
        }),
      };
    case "not":
      return { kind: "not", predicate: lowerPredicate(predicate.predicate) };
    case "slot":
      return { kind: "slot", slot: predicate.slot };
    case "wildcard":
      return { kind: "true" };
    default:
      return assertNever(predicate);
  }
};

const covers = (
  previous: CompiledPredicate,
  current: CompiledPredicate,
): boolean => {
  if (previous.kind === "true") {
    return true;
  }
  if (deepEqual(previous, current)) {
    return true;
  }
  if (previous.kind === "typeOf" && current.kind === "eq") {
    return matchesType(previous.value, current.value);
  }
  if (
    previous.kind === "tagEq" &&
    current.kind === "tagEq" &&
    previous.key === current.key &&
    deepEqual(previous.value, current.value)
  ) {
    return true;
  }
  if (previous.kind === "tagEq" && current.kind === "and") {
    return current.predicates.some(
      (item) =>
        item.kind === "tagEq" &&
        item.key === previous.key &&
        deepEqual(item.value, previous.value),
    );
  }
  if (previous.kind === "shape" && current.kind === "shape") {
    const keys = Object.keys(previous.fields);
    const subset = keys.every((key) => {
      const left = previous.fields[key];
      const right = current.fields[key];
      return right !== undefined && covers(left, right);
    });
    if (!subset) {
      return false;
    }
    return previous.exact
      ? current.exact && keys.length === Object.keys(current.fields).length
      : true;
  }
  return false;
};

const containsSlot = (predicate: CompiledPredicate): boolean => {
  switch (predicate.kind) {
    case "slot":
      return true;
    case "and":
    case "or":
      return predicate.predicates.some(containsSlot);
    case "not":
      return containsSlot(predicate.predicate);
    case "shape":
      return Object.values(predicate.fields).some(containsSlot);
    default:
      return false;
  }
};

const maxSlotIndex = (predicate: CompiledPredicate): number => {
  switch (predicate.kind) {
    case "slot":
      return predicate.slot;
    case "and":
    case "or":
      return predicate.predicates.reduce(
        (max, item) => Math.max(max, maxSlotIndex(item)),
        0,
      );
    case "not":
      return maxSlotIndex(predicate.predicate);
    case "shape":
      return Object.values(predicate.fields).reduce(
        (max, item) => Math.max(max, maxSlotIndex(item)),
        0,
      );
    default:
      return 0;
  }
};

export const canonicalizePredicate = (predicate: PredicateAst): PredicateAst => {
  switch (predicate.kind) {
    case "shape": {
      const nextFields = Object.fromEntries(
        Object.entries(predicate.fields).map(([key, value]) => [
          key,
          canonicalizePredicate(value),
        ]),
      );
      const keys = Object.keys(nextFields);
      const onlyKey = keys[0];
      const isArrayIndex = onlyKey !== undefined && /^\d+$/.test(onlyKey);
      if (
        !predicate.exact &&
        keys.length === 1 &&
        !isArrayIndex &&
        nextFields[onlyKey]?.kind === "eq"
      ) {
        return {
          kind: "tag",
          key: onlyKey,
          value: (nextFields[onlyKey] as { kind: "eq"; value: MatchValue }).value,
        };
      }
      return {
        kind: "shape",
        fields: nextFields,
        exact: Boolean(predicate.exact),
      };
    }
    case "and":
      return {
        kind: "and",
        predicates: predicate.predicates.flatMap((item) => {
          const normalized = canonicalizePredicate(item);
          return normalized.kind === "and"
            ? normalized.predicates
            : [normalized];
        }),
      };
    case "or":
      return {
        kind: "or",
        predicates: predicate.predicates.flatMap((item) => {
          const normalized = canonicalizePredicate(item);
          return normalized.kind === "or"
            ? normalized.predicates
            : [normalized];
        }),
      };
    case "not":
      return {
        kind: "not",
        predicate: canonicalizePredicate(predicate.predicate),
      };
    default:
      return predicate;
  }
};

export const compileProgramInJs = (program: CompileProgram): CompilePlan => {
  const diagnostics: CompileDiagnostic[] = [];
  const branches: CompileBranch[] = [];
  const previous: CompiledPredicate[] = [];
  let dynamicSlotCount = 0;

  program.branches.forEach((branch, branchIndex) => {
    const actionIndex = branch.actionIndex ?? branchIndex;
    const predicate = lowerPredicate(canonicalizePredicate(branch.predicate));

    if (previous.some((item) => covers(item, predicate))) {
      diagnostics.push({
        code: "unreachable_branch",
        level: "warning",
        message: `branch ${branchIndex} is shadowed by a previous predicate`,
        branchIndex,
      });
    }
    if (containsSlot(predicate)) {
      diagnostics.push({
        code: "dynamic_slot",
        level: "info",
        message: `branch ${branchIndex} contains runtime slot predicate`,
        branchIndex,
      });
    }

    dynamicSlotCount = Math.max(dynamicSlotCount, maxSlotIndex(predicate) + 1);
    previous.push(predicate);
    branches.push({ actionIndex, predicate });
  });

  return {
    version: COMPILE_PLAN_VERSION,
    branches,
    diagnostics,
    dynamicSlotCount,
  };
};
