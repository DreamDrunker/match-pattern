import type { CompileDiagnostic, MatchValue } from "./internal/ast";
import type { PredicateValue } from "./internal/predicate";

export type MatchLiteral = MatchValue;

export type Predicate<TInput = MatchLiteral, TMatched = never> =
  PredicateValue & {
    readonly __inputType?: TInput;
    readonly __matchedType?: TMatched;
  };

type ObjectPattern<TData> = TData extends object ? Partial<TData> : never;
type TypeGuardPattern<TData, TMatched extends TData = TData> = (
  data: TData,
) => data is TMatched;

type MatchedByPattern<TData, TPattern> =
  [TPattern] extends [undefined]
    ? TData
    : TPattern extends Predicate<infer TInput, infer TMatched>
      ? [TData] extends [TInput]
        ? Extract<TData, TMatched>
        : never
      : TPattern extends TypeGuardPattern<TData, infer TMatched>
        ? Extract<TData, TMatched>
        : TPattern extends (...args: readonly unknown[]) => boolean
          ? never
          : Extract<TData, TPattern>;

export type RemainingByPattern<TData, TPattern> = Exclude<
  TData,
  MatchedByPattern<TData, TPattern>
>;

type ExhaustiveRunArgs<TRemaining> = [TRemaining] extends [never]
  ? []
  : ["Non-exhaustive match. Add branches or use otherwise()."];

export type Pattern<TData = MatchLiteral> =
  | TData
  | ObjectPattern<TData>
  | Predicate<MatchLiteral, MatchLiteral>
  | ((data: TData) => boolean)
  | TypeGuardPattern<TData>
  | undefined;

export type PatternInput<TData> = {
  type: "Value" | "Object" | "Function" | "Wildcard";
  value?: TData;
  pattern?: Pattern<TData>;
  func?: (data: TData) => boolean;
};

export type ResultEntry<TData, TResult = never> =
  | { value: TResult; isMapper: false }
  | { value: (data: TData) => TResult; isMapper: true };

export type Matcher<TData, TResult = never, TRemaining = TData> = {
  when: <const TPattern extends Pattern<TRemaining>>(
    pattern: [TRemaining] extends [never] ? never : TPattern,
  ) => MatcherWithPattern<TData, TResult, TRemaining, TPattern>;
  otherwise: <TNext>(value: TNext) => TResult | TNext;
  run: (...args: ExhaustiveRunArgs<TRemaining>) => TResult;
  diagnostics: () => readonly CompileDiagnostic[];
};

export type MatcherWithPattern<
  TData,
  TResult,
  TRemaining,
  TPattern extends Pattern<TRemaining>,
> = {
  to: <TNext>(
    value: TNext,
  ) => Matcher<TData, TResult | TNext, RemainingByPattern<TRemaining, TPattern>>;
  map: <TNext>(
    fn: (data: TData) => TNext,
  ) => Matcher<TData, TResult | TNext, RemainingByPattern<TRemaining, TPattern>>;
};
