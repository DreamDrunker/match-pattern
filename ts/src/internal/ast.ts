export type MatchValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | MatchValue[]
  | { [key: string]: MatchValue };

export type PredicateAst =
  | { kind: "isNumber" }
  | { kind: "isString" }
  | { kind: "isBoolean" }
  | { kind: "isNull" }
  | { kind: "isUndefined" }
  | { kind: "eq"; value: MatchValue }
  | { kind: "tag"; key: string; value: MatchValue }
  | { kind: "shape"; fields: Record<string, PredicateAst>; exact?: boolean }
  | { kind: "and"; predicates: PredicateAst[] }
  | { kind: "or"; predicates: PredicateAst[] }
  | { kind: "not"; predicate: PredicateAst }
  | { kind: "slot"; slot: number }
  | { kind: "wildcard" };

export type CompiledPredicate =
  | { kind: "typeOf"; value: "number" | "string" | "boolean" | "object" }
  | { kind: "isNull" }
  | { kind: "isUndefined" }
  | { kind: "eq"; value: MatchValue }
  | { kind: "tagEq"; key: string; value: MatchValue }
  | { kind: "shape"; fields: Record<string, CompiledPredicate>; exact: boolean }
  | { kind: "and"; predicates: CompiledPredicate[] }
  | { kind: "or"; predicates: CompiledPredicate[] }
  | { kind: "not"; predicate: CompiledPredicate }
  | { kind: "slot"; slot: number }
  | { kind: "true" };

export type CompileDiagnostic = {
  code: string;
  level: "info" | "warning" | "error";
  message: string;
  branchIndex: number;
};

export type CompileBranch = {
  actionIndex: number;
  predicate: CompiledPredicate;
};

export type CompilePlan = {
  version: number;
  branches: CompileBranch[];
  diagnostics: CompileDiagnostic[];
  dynamicSlotCount: number;
};

export type CompileProgram = {
  branches: Array<{
    actionIndex?: number;
    predicate: PredicateAst;
  }>;
};
