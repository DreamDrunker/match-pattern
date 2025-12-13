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

export type ResultEntry<T, R = unknown> =
  | { value: R; isMapper: false }
  | { value: (data: T) => R; isMapper: true };

export type Matcher<T, R = never> = {
  when: (pattern: Pattern<T>) => MatcherWithPattern<T, R>;
  otherwise: <TResult>(value: TResult) => R | TResult;
  run: () => R;
};

export type MatcherWithPattern<T, R = never> = {
  to: <TResult>(value: TResult) => Matcher<T, R | TResult>;
  map: <TResult>(fn: (data: T) => TResult) => Matcher<T, R | TResult>;
};
