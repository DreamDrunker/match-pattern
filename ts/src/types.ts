export type Pattern<T = any> =
  | T
  | Partial<T>
  | ((data: T) => boolean)
  | undefined;

export type PatternInput<T> = {
  type: "Value" | "Object" | "Function" | "Wildcard";
  value?: T;
  pattern?: Pattern<T>;
  func?: (data: T) => boolean;
};

export type WasmBranch<T, R> = {
  pattern: PatternInput<T>;
  result: R | ((data: T) => R);
};

export type Matcher<T, R = never> = {
  when(pattern: Pattern<T>): MatcherWithPattern<T, R>;
  otherwise<TResult>(value: TResult | ((data: T) => TResult)): R | TResult;
  run(): R | undefined;
};

export type MatcherWithPattern<T, R> = {
  to<TResult>(value: TResult): Matcher<T, R | TResult>;
};
