export { compileProgramInJs } from "./internal/compiler";
export {
  createMatchEngine,
  type MatchEngine,
  type MatchEngineOptions,
} from "./internal/engine";
export { createSlotRegistry } from "./internal/predicate";
export type {
  CompileDiagnostic,
  CompilePlan,
  CompileProgram,
  CompiledPredicate,
  MatchValue,
  PredicateAst,
} from "./internal/ast";
