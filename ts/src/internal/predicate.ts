import type { MatchLiteral, Pattern, Predicate } from "../types";
import type { MatchValue, PredicateAst } from "./ast";
import { canonicalizePredicate } from "./compiler";
import { isPlainObject } from "./object";

export type AnyFunction<
  TInput = string | number | boolean | object | null | undefined,
  TResult = boolean,
> = (
  value: TInput,
) => TResult;

const PREDICATE_SYMBOL = Symbol.for("@weiqu_/match-pattern/predicate");

export type PredicateValue = {
  readonly [PREDICATE_SYMBOL]: true;
  readonly ast: PredicateAst;
};

export type SlotRegistry = {
  readonly ids: WeakMap<AnyFunction, number>;
  readonly slots: Map<number, AnyFunction>;
  nextSlot: number;
};

const createRegistry = (): SlotRegistry => ({
  ids: new WeakMap(),
  slots: new Map(),
  nextSlot: 0,
});

const defaultSlotRegistry = createRegistry();

export const getDefaultSlotRegistry = (): SlotRegistry => defaultSlotRegistry;

export const createSlotRegistry = (): SlotRegistry => createRegistry();

export const registerSlot = (registry: SlotRegistry, fn: AnyFunction): number => {
  const existing = registry.ids.get(fn);
  if (existing !== undefined) {
    return existing;
  }
  const slot = registry.nextSlot;
  registry.nextSlot += 1;
  registry.ids.set(fn, slot);
  registry.slots.set(slot, fn);
  return slot;
};

export const isPredicateValue = (value: unknown): value is PredicateValue =>
  isPlainObject(value) &&
  Object.prototype.hasOwnProperty.call(value, PREDICATE_SYMBOL) &&
  (value as Record<PropertyKey, unknown>)[PREDICATE_SYMBOL] === true;

const createPredicate = (ast: PredicateAst): PredicateValue => ({
  [PREDICATE_SYMBOL]: true,
  ast: canonicalizePredicate(ast),
});

const typedPredicate = <TInput, TMatched = never>(
  predicate: PredicateValue,
): Predicate<TInput, TMatched> => predicate as Predicate<TInput, TMatched>;

type PredicateMatched<TPredicate> = TPredicate extends Predicate<
  MatchLiteral,
  infer TMatched
>
  ? TMatched
  : never;

type UnionToIntersection<TValue> = (
  TValue extends unknown ? (value: TValue) => void : never
) extends (value: infer TResult) => void
  ? TResult
  : never;

type ShapeFieldValue =
  | MatchLiteral
  | Predicate<MatchLiteral, MatchLiteral>
  | AnyFunction;

type ShapeFieldMatched<TField> = TField extends Predicate<
  MatchLiteral,
  infer TMatched
>
  ? TMatched
  : TField extends AnyFunction
    ? MatchLiteral
    : TField extends MatchLiteral
      ? TField
      : never;

type ShapeMatched<TFields extends Record<string, ShapeFieldValue>> = {
  [TKey in keyof TFields]: ShapeFieldMatched<TFields[TKey]>;
};

const asLiteral = (value: MatchValue): MatchLiteral => value;

const toFieldAst = (
  value: MatchValue | PredicateValue | AnyFunction,
  slotRegistry: SlotRegistry,
): PredicateAst => {
  if (isPredicateValue(value)) {
    return value.ast;
  }
  if (typeof value === "function") {
    return {
      kind: "slot",
      slot: registerSlot(slotRegistry, value),
    };
  }
  if (isPlainObject(value)) {
    return {
      kind: "shape",
      fields: Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          toFieldAst(item as MatchLiteral | PredicateValue | AnyFunction, slotRegistry),
        ]),
      ),
      exact: false,
    };
  }
  return { kind: "eq", value: asLiteral(value) };
};

export const patternToAst = <TData>(
  pattern: Pattern<TData>,
  slotRegistry: SlotRegistry,
): PredicateAst => {
  if (pattern === undefined) {
    return { kind: "wildcard" };
  }
  if (isPredicateValue(pattern)) {
    return pattern.ast;
  }
  if (typeof pattern === "function") {
    return {
      kind: "slot",
      slot: registerSlot(slotRegistry, pattern as AnyFunction),
    };
  }
  if (isPlainObject(pattern)) {
    return {
      kind: "shape",
      fields: Object.fromEntries(
        Object.entries(
          pattern as Record<string, MatchValue | PredicateValue | AnyFunction>,
        ).map(([key, value]) => [key, toFieldAst(value, slotRegistry)]),
      ),
      exact: false,
    };
  }
  return { kind: "eq", value: asLiteral(pattern as MatchValue) };
};

export const isNumber = <TInput = MatchLiteral>(): Predicate<
  TInput,
  Extract<TInput, number>
> => typedPredicate(createPredicate({ kind: "isNumber" }));
export const isString = <TInput = MatchLiteral>(): Predicate<
  TInput,
  Extract<TInput, string>
> => typedPredicate(createPredicate({ kind: "isString" }));
export const isBoolean = <TInput = MatchLiteral>(): Predicate<
  TInput,
  Extract<TInput, boolean>
> => typedPredicate(createPredicate({ kind: "isBoolean" }));
export const isNull = <TInput = MatchLiteral>(): Predicate<
  TInput,
  Extract<TInput, null>
> => typedPredicate(createPredicate({ kind: "isNull" }));
export const isUndefined = <TInput = MatchLiteral>(): Predicate<
  TInput,
  Extract<TInput, undefined>
> => typedPredicate(createPredicate({ kind: "isUndefined" }));
export const eq = <TValue extends MatchLiteral>(
  value: TValue,
): Predicate<MatchLiteral, TValue> =>
  typedPredicate(createPredicate({ kind: "eq", value }));
export const tag = <TKey extends string, TValue extends MatchLiteral>(
  key: TKey,
  value: TValue,
): Predicate<MatchLiteral, Record<TKey, TValue>> =>
  typedPredicate(createPredicate({ kind: "tag", key, value }));

export const shape = <const TFields extends Record<string, ShapeFieldValue>>(
  fields: TFields,
): Predicate<MatchLiteral, ShapeMatched<TFields>> =>
  typedPredicate(createPredicate({
    kind: "shape",
    fields: Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [
        key,
        toFieldAst(value, defaultSlotRegistry),
      ]),
    ),
    exact: false,
  }));

export const exactShape = <const TFields extends Record<string, ShapeFieldValue>>(
  fields: TFields,
): Predicate<MatchLiteral, ShapeMatched<TFields>> =>
  typedPredicate(createPredicate({
    kind: "shape",
    fields: Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [
        key,
        toFieldAst(value, defaultSlotRegistry),
      ]),
    ),
    exact: true,
  }));

export const and = <const TPredicates extends readonly PredicateValue[]>(
  ...predicates: TPredicates
): Predicate<
  MatchLiteral,
  UnionToIntersection<PredicateMatched<TPredicates[number]>>
> =>
  typedPredicate(createPredicate({
    kind: "and",
    predicates: predicates.map((item) => item.ast),
  }));

export const or = <const TPredicates extends readonly PredicateValue[]>(
  ...predicates: TPredicates
): Predicate<MatchLiteral, PredicateMatched<TPredicates[number]>> =>
  typedPredicate(createPredicate({
    kind: "or",
    predicates: predicates.map((item) => item.ast),
  }));

export const not = (predicate: PredicateValue): Predicate<MatchLiteral, never> =>
  typedPredicate(createPredicate({
    kind: "not",
    predicate: predicate.ast,
  }));

export const wildcard = <TInput = MatchLiteral>(): Predicate<TInput, TInput> =>
  typedPredicate(createPredicate({ kind: "wildcard" }));

export function slot<TMatched extends MatchLiteral>(
  predicate: (value: MatchLiteral) => value is TMatched,
): Predicate<MatchLiteral, TMatched>;
export function slot(
  predicate: (value: MatchLiteral) => boolean,
): Predicate<MatchLiteral, never>;
export function slot(
  predicate: (value: MatchLiteral) => boolean,
): Predicate<MatchLiteral, MatchLiteral> {
  return typedPredicate(createPredicate({
    kind: "slot",
    slot: registerSlot(defaultSlotRegistry, predicate as AnyFunction),
  }));
}

const isGreaterThan =
  (limit: number) =>
  (value: MatchLiteral): boolean =>
    typeof value === "number" && value > limit;

const isLessThan =
  (limit: number) =>
  (value: MatchLiteral): boolean =>
    typeof value === "number" && value < limit;

export const gt = (limit: number): Predicate<MatchLiteral, never> =>
  slot(isGreaterThan(limit));

export const lt = (limit: number): Predicate<MatchLiteral, never> =>
  slot(isLessThan(limit));
