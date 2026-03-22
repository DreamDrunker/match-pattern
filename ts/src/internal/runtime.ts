import type { AnyFunction, SlotRegistry } from "./predicate";
import type { CompilePlan, CompiledPredicate } from "./ast";
import { deepEqual, isPlainObject, type PlainObject } from "./object";

const assertNever = (value: never): never => {
  throw new Error(`unexpected variant: ${JSON.stringify(value)}`);
};
type RuntimeValue = string | number | boolean | object | null | undefined;
type TypeOfValue = Extract<CompiledPredicate, { kind: "typeOf" }>["value"];

const matchesType = (
  typeName: TypeOfValue,
  value: RuntimeValue,
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

const evaluateCompiledPredicate = (
  value: RuntimeValue,
  predicate: CompiledPredicate,
  slots: Map<number, AnyFunction>,
): boolean => {
  switch (predicate.kind) {
    case "typeOf":
      return matchesType(predicate.value, value);
    case "isNull":
      return value === null;
    case "isUndefined":
      return value === undefined;
    case "eq":
      return deepEqual(value, predicate.value);
    case "tagEq":
      return (
        isPlainObject(value) &&
        deepEqual((value as PlainObject)[predicate.key], predicate.value)
      );
    case "shape": {
      if (!isPlainObject(value)) {
        return false;
      }
      const source = value as PlainObject;
      const fields = Object.entries(predicate.fields);
      const partialMatch = fields.every(([key, item]) =>
        evaluateCompiledPredicate(source[key] ?? undefined, item, slots),
      );
      if (!partialMatch) {
        return false;
      }
      return predicate.exact ? Object.keys(source).length === fields.length : true;
    }
    case "and":
      return predicate.predicates.every((item) =>
        evaluateCompiledPredicate(value, item, slots),
      );
    case "or":
      return predicate.predicates.some((item) =>
        evaluateCompiledPredicate(value, item, slots),
      );
    case "not":
      return !evaluateCompiledPredicate(value, predicate.predicate, slots);
    case "slot": {
      const fn = slots.get(predicate.slot);
      return fn ? Boolean(fn(value)) : false;
    }
    case "true":
      return true;
    default:
      return assertNever(predicate);
  }
};

export const buildMatcher = (
  plan: CompilePlan,
  slotRegistry: SlotRegistry,
): ((value: RuntimeValue) => number) => {
  const slots = slotRegistry.slots;
  return (value: RuntimeValue): number => {
    for (const branch of plan.branches) {
      if (evaluateCompiledPredicate(value, branch.predicate, slots)) {
        return branch.actionIndex;
      }
    }
    return -1;
  };
};
