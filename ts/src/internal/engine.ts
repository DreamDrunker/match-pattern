import type {
  MatchLiteral,
  Matcher,
  Pattern,
  RemainingByPattern,
  ResultEntry,
} from "../types";
import type { CompilePlan, CompileProgram } from "./ast";
import { createLruCache, stableSerialize } from "./cache";
import { compileProgramInJs } from "./compiler";
import { getDefaultSlotRegistry, patternToAst, type SlotRegistry } from "./predicate";
import { buildMatcher } from "./runtime";

const DEFAULT_CACHE_SIZE = 512;
const DEFAULT_COMPILER_VERSION = "compiler-js-v1";

type Compiler = (program: CompileProgram) => CompilePlan;
type CompilerVersionResolver = () => string;

type EngineCacheItem<TData> = {
  key: string;
  plan: CompilePlan;
  matcher: (value: TData) => number;
};

type MatchEngineInternal = MatchEngine & {
  readonly slotRegistry: SlotRegistry;
  compileWithCache: <TData>(program: CompileProgram) => EngineCacheItem<TData>;
};

export type MatchEngineOptions = {
  compile?: Compiler;
  fallbackCompile?: Compiler;
  compilerVersion?: string | CompilerVersionResolver;
  cacheSize?: number;
  precompiledPlans?: Record<string, CompilePlan>;
  slotRegistry?: SlotRegistry;
};

export type MatchEngine = {
  match: <const TData>(data: TData) => Matcher<TData, never>;
  buildCacheKey: (program: CompileProgram) => string;
  registerPrecompiledPlan: (key: string, plan: CompilePlan) => void;
};

const getHostPrecompiledPlans = (): Record<string, CompilePlan> => {
  const holder = globalThis as {
    __MATCH_PATTERN_PRECOMPILED__?: Record<string, CompilePlan>;
  };
  return holder.__MATCH_PATTERN_PRECOMPILED__ ?? {};
};

const toProgram = <TData>(
  patterns: readonly Pattern<TData>[],
  slotRegistry: SlotRegistry,
): CompileProgram => ({
  branches: patterns.map((pattern, index) => ({
    actionIndex: index,
    predicate: patternToAst(pattern, slotRegistry),
  })),
});

const resolveResult = <TData, TResult>(
  entry: ResultEntry<TData, TResult>,
  data: TData,
): TResult => (entry.isMapper ? entry.value(data) : entry.value);

const createMatcher = <TData, TResult, TRemaining = TData>(
  data: TData,
  patterns: readonly Pattern<TData>[],
  entries: readonly ResultEntry<TData, TResult>[],
  engine: MatchEngineInternal,
): Matcher<TData, TResult, TRemaining> => {
  let compiled: EngineCacheItem<TData> | null = null;

  const ensureCompiled = (): EngineCacheItem<TData> => {
    if (compiled) {
      return compiled;
    }
    const program = toProgram(patterns, engine.slotRegistry);
    compiled = engine.compileWithCache<TData>(program);
    return compiled;
  };

  return {
    when: <const TPattern extends Pattern<TRemaining>>(
      pattern: [TRemaining] extends [never] ? never : TPattern,
    ) => ({
      to: <TNext>(value: TNext) => {
        const nextEntries = [
          ...entries,
          { value, isMapper: false } as ResultEntry<TData, TResult | TNext>,
        ] as const;
        return createMatcher<
          TData,
          TResult | TNext,
          RemainingByPattern<TRemaining, TPattern>
        >(
          data,
          [...patterns, pattern as Pattern<TData>],
          nextEntries,
          engine,
        );
      },
      map: <TNext>(fn: (input: TData) => TNext) => {
        const nextEntries = [
          ...entries,
          { value: fn, isMapper: true } as ResultEntry<TData, TResult | TNext>,
        ] as const;
        return createMatcher<
          TData,
          TResult | TNext,
          RemainingByPattern<TRemaining, TPattern>
        >(
          data,
          [...patterns, pattern as Pattern<TData>],
          nextEntries,
          engine,
        );
      },
    }),
    otherwise: <TNext>(value: TNext): TResult | TNext => {
      const nextEntries = [
        ...entries,
        { value, isMapper: false } as ResultEntry<TData, TResult | TNext>,
      ] as const;
      return createMatcher<TData, TResult | TNext, never>(
        data,
        [...patterns, undefined],
        nextEntries,
        engine,
      ).run();
    },
    run: (..._args: readonly string[]): TResult => {
      if (patterns.length === 0) {
        throw new Error("run what?");
      }
      const matchIndex = ensureCompiled().matcher(data);
      if (matchIndex < 0) {
        throw new Error("No match found");
      }
      const entry = entries[matchIndex];
      if (!entry) {
        throw new Error("Matched branch has no result entry");
      }
      return resolveResult(entry, data);
    },
    diagnostics: () => {
      if (patterns.length === 0) {
        return [];
      }
      return ensureCompiled().plan.diagnostics;
    },
  };
};

export const createMatchEngine = (
  options: MatchEngineOptions = {},
): MatchEngine => {
  const primaryCompile = options.compile ?? compileProgramInJs;
  const fallbackCompile = options.fallbackCompile ?? compileProgramInJs;
  const slotRegistry = options.slotRegistry ?? getDefaultSlotRegistry();
  const compilerVersion =
    typeof options.compilerVersion === "function"
      ? options.compilerVersion
      : () => options.compilerVersion ?? DEFAULT_COMPILER_VERSION;
  const cache = createLruCache<EngineCacheItem<MatchLiteral>>(
    options.cacheSize ?? DEFAULT_CACHE_SIZE,
  );
  const precompiledPlans: Record<string, CompilePlan> = {
    ...getHostPrecompiledPlans(),
    ...(options.precompiledPlans ?? {}),
  };

  const buildCacheKey = (program: CompileProgram): string =>
    stableSerialize({
      compilerVersion: compilerVersion(),
      program,
    });

  const compileWithCache = <TData>(program: CompileProgram): EngineCacheItem<TData> => {
    const key = buildCacheKey(program);
    const found = cache.get(key);
    if (found) {
      return found as EngineCacheItem<TData>;
    }

    let plan = precompiledPlans[key];
    if (!plan) {
      try {
        plan = primaryCompile(program);
      } catch {
        plan = fallbackCompile(program);
      }
    }

    const matcher = buildMatcher(plan, slotRegistry) as (value: TData) => number;
    const item: EngineCacheItem<TData> = { key, plan, matcher };
    cache.set(key, item as EngineCacheItem<MatchLiteral>);
    return item;
  };

  const registerPrecompiledPlan = (key: string, plan: CompilePlan): void => {
    precompiledPlans[key] = plan;
  };

  const engine: MatchEngineInternal = {
    match: <const TData>(data: TData): Matcher<TData, never> =>
      createMatcher(data, [], [], engine),
    buildCacheKey,
    registerPrecompiledPlan,
    slotRegistry,
    compileWithCache,
  };

  return engine;
};
